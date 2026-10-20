
require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { Server } = require('socket.io')

const authRoutes = require('./routes/authRoutes')
const meetingRoutes = require('./routes/meetingRoutes')
const connectDB = require('./config/db')
const Meeting = require('./models/Meeting')
const Message = require('./models/Message')

const app = express()
const httpServer = http.createServer(app)

const PORT = process.env.PORT || 5000
const MAX_PARTICIPANTS = 2
const MAX_MESSAGE_LENGTH = 1000
const MAX_HISTORY_MESSAGES = 500
const SHUTDOWN_TIMEOUT = 10000

const CLIENT_URLS = [
  'http://localhost:5173',
  'https://intellmeet-frontend-bg46.onrender.com',
  ...(process.env.CLIENT_URLS || '')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean),
].filter((url, index, urls) => urls.indexOf(url) === index)

const corsOptions = {
  origin(origin, callback) {
    if (!origin || CLIENT_URLS.includes(origin.replace(/\/+$/, ''))) {
      callback(null, true)
      return
    }

    console.warn('CORS blocked origin:', origin)
    callback(new Error('Origin not allowed by CORS'))
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}

const io = new Server(httpServer, {
  cors: corsOptions,
  maxHttpBufferSize: 1e6,
})

app.set('io', io)

app.disable('x-powered-by')
app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/meetings', meetingRoutes)

app.get('/', (req, res) => {
  res.status(200).send('IntellMeet backend is running!')
})

app.get('/health', (req, res) => {
  const readyState = mongoose.connection.readyState
  const databaseConnected = readyState === 1

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'error',
    server: 'running',
    database: databaseConnected ? 'connected' : 'disconnected',
    databaseState:
      ['disconnected', 'connected', 'connecting', 'disconnecting'][readyState] ||
      'unknown',
  })
})

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found.',
    method: req.method,
    path: req.originalUrl,
  })
})

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err.message === 'Origin not allowed by CORS') {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({ message: 'Invalid JSON request body.' })
    return
  }

  console.error('HTTP request failed:', err.message)
  res.status(500).json({ message: 'Internal server error.' })
})

// Normalize meeting codes consistently across Socket.IO events.
const normalizeMeetingCode = (value) => {
  if (typeof value !== 'string') return ''

  return value.trim().replace(/^CODE/i, '').trim().toLowerCase()
}

const isValidMeetingCode = (code) => {
  const normalizedCode = normalizeMeetingCode(code)

  return normalizedCode.length > 0 && normalizedCode.length <= 64
}

const getValidRoomName = (payload, socket) => {
  const roomName = normalizeMeetingCode(payload?.room)

  if (!roomName || !socket.data.meetingRooms.has(roomName)) {
    return null
  }

  return roomName
}

const isValidSignalDescription = (description) => {
  return (
    description &&
    typeof description === 'object' &&
    !Array.isArray(description) &&
    typeof description.type === 'string' &&
    typeof description.sdp === 'string' &&
    description.sdp.length <= 100000
  )
}

const isValidIceCandidate = (candidate) => {
  return (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    typeof candidate.candidate === 'string' &&
    candidate.candidate.length <= 10000
  )
}

const leaveRoom = async (socket, roomName, notifyPeer = true) => {
  if (!socket.data.meetingRooms.has(roomName)) {
    return
  }

  if (notifyPeer) {
    socket.to(roomName).emit('peer-left')
  }

  await socket.leave(roomName)
  socket.data.meetingRooms.delete(roomName)

  console.log(`Socket ${socket.id} left meeting ${roomName}`)
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  socket.data.meetingRooms = new Set()

  socket.on('join-room', async (meetingCode) => {
    let roomName

    try {
      if (!isValidMeetingCode(meetingCode)) {
        socket.emit('join-error', 'Invalid meeting code.')
        return
      }

      roomName = normalizeMeetingCode(meetingCode)

      if (socket.data.meetingRooms.has(roomName)) {
        return
      }

      if (socket.data.meetingRooms.size > 0) {
        socket.emit(
          'join-error',
          'Leave your current meeting before joining another.'
        )
        return
      }

      let meeting = await Meeting.findOne({
        meetingCode: roomName,
      }).select('meetingCode status')

      if (!meeting) {
        socket.emit('join-error', 'Meeting not found.')
        return
      }

      if (meeting.status === 'ended') {
        socket.emit('join-error', 'This meeting has already ended.')
        return
      }

      let room = io.sockets.adapter.rooms.get(roomName)
      let participantCount = room ? room.size : 0

      if (participantCount >= MAX_PARTICIPANTS) {
        socket.emit('room-full')
        return
      }

      await Meeting.updateOne(
        {
          meetingCode: roomName,
          status: 'scheduled',
        },
        {
          $set: { status: 'active' },
        }
      )

      meeting = await Meeting.findOne({
        meetingCode: roomName,
      }).select('status')

      if (!meeting || meeting.status === 'ended') {
        socket.emit('join-error', 'This meeting has already ended.')
        return
      }

      await socket.join(roomName)
      socket.data.meetingRooms.add(roomName)

      room = io.sockets.adapter.rooms.get(roomName)
      participantCount = room ? room.size : 0

      if (participantCount > MAX_PARTICIPANTS) {
        await leaveRoom(socket, roomName, false)
        socket.emit('room-full')
        return
      }

      meeting = await Meeting.findOne({
        meetingCode: roomName,
      }).select('status')

      if (!meeting || meeting.status === 'ended') {
        await leaveRoom(socket, roomName, false)
        socket.emit('join-error', 'This meeting has already ended.')
        return
      }

      const history = await Message.find({
        meetingCode: roomName,
      })
        .sort({ createdAt: 1, _id: 1 })
        .limit(MAX_HISTORY_MESSAGES)
        .lean()

      const latestMeeting = await Meeting.findOne({
        meetingCode: roomName,
      }).select('status')

      if (!latestMeeting || latestMeeting.status === 'ended') {
        await leaveRoom(socket, roomName, false)
        socket.emit('join-error', 'This meeting has already ended.')
        return
      }

      socket.emit(
        'chat-history',
        history.map((item) => ({
          senderId: item.senderId,
          message: item.message,
          timestamp: item.createdAt.toISOString(),
        }))
      )

      socket.emit('room-joined', {
        isInitiator: participantCount === 1,
      })

      socket.to(roomName).emit('peer-joined')

      console.log(`Socket ${socket.id} joined meeting ${roomName}`)
    } catch (error) {
      console.error('Join room failed:', error.message)

      if (roomName && socket.data.meetingRooms.has(roomName)) {
        try {
          await leaveRoom(socket, roomName, false)
        } catch (cleanupError) {
          console.error('Join cleanup failed:', cleanupError.message)
        }
      }

      socket.emit('join-error', 'Unable to join this meeting.')
    }
  })

  socket.on('offer', (payload = {}) => {
    const roomName = getValidRoomName(payload, socket)

    if (!roomName || !isValidSignalDescription(payload.offer)) return

    socket.to(roomName).emit('offer', payload.offer)
  })

  socket.on('answer', (payload = {}) => {
    const roomName = getValidRoomName(payload, socket)

    if (!roomName || !isValidSignalDescription(payload.answer)) return

    socket.to(roomName).emit('answer', payload.answer)
  })

  socket.on('ice-candidate', (payload = {}) => {
    const roomName = getValidRoomName(payload, socket)

    if (!roomName || !isValidIceCandidate(payload.candidate)) return

    socket.to(roomName).emit('ice-candidate', payload.candidate)
  })

  socket.on('chat-message', async (payload = {}) => {
    let savedMessage = null

    try {
      const roomName = getValidRoomName(payload, socket)

      if (!roomName) {
        socket.emit('chat-error', {
          message: 'You must join the meeting before sending messages.',
        })
        return
      }

      if (typeof payload.message !== 'string') {
        socket.emit('chat-error', { message: 'Invalid message.' })
        return
      }

      const message = payload.message.trim()

      if (!message || message.length > MAX_MESSAGE_LENGTH) {
        socket.emit('chat-error', {
          message: 'Message must contain 1–1000 characters.',
        })
        return
      }

      const meeting = await Meeting.findOne({
        meetingCode: roomName,
        status: { $ne: 'ended' },
      }).select('_id')

      if (!meeting) {
        socket.emit('chat-error', {
          message: 'This meeting has ended or does not exist.',
        })
        return
      }

      savedMessage = await Message.create({
        meetingCode: roomName,
        senderId: socket.id,
        message,
      })

      const latestMeeting = await Meeting.findOne({
        meetingCode: roomName,
        status: { $ne: 'ended' },
      }).select('_id')

      if (!latestMeeting) {
        await Message.deleteOne({
          _id: savedMessage._id,
          meetingCode: roomName,
        })

        savedMessage = null

        socket.emit('chat-error', {
          message: 'This meeting has ended. Your message was not delivered.',
        })
        return
      }

      io.to(roomName).emit('chat-message', {
        senderId: savedMessage.senderId,
        message: savedMessage.message,
        timestamp: savedMessage.createdAt.toISOString(),
      })

      console.log(`Chat message saved in meeting ${roomName}`)
    } catch (error) {
      console.error('Save chat message failed:', error.message)

      if (savedMessage) {
        try {
          const latestMeeting = await Meeting.findOne({
            meetingCode: savedMessage.meetingCode,
            status: { $ne: 'ended' },
          }).select('_id')

          if (!latestMeeting) {
            await Message.deleteOne({
              _id: savedMessage._id,
              meetingCode: savedMessage.meetingCode,
            })
          }
        } catch (cleanupError) {
          console.error('Late message cleanup failed:', cleanupError.message)
        }
      }

      socket.emit('chat-error', {
        message: 'Unable to save your message. Please try again.',
      })
    }
  })

  socket.on('leave-room', async (meetingCode) => {
    try {
      if (!isValidMeetingCode(meetingCode)) return

      const roomName = normalizeMeetingCode(meetingCode)

      await leaveRoom(socket, roomName)
    } catch (error) {
      console.error('Leave room failed:', error.message)
    }
  })

  socket.on('disconnecting', () => {
    for (const roomName of socket.data.meetingRooms) {
      socket.to(roomName).emit('peer-left')
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`)
    socket.data.meetingRooms.clear()
  })

  socket.on('error', (error) => {
    console.error('Socket error:', error.message)
  })
})

async function startServer() {
  try {
    await connectDB()

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`)
      console.log(`Allowed frontend origins: ${CLIENT_URLS.join(', ')}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

let isShuttingDown = false

async function shutdown(signal) {
  if (isShuttingDown) return

  isShuttingDown = true
  console.log(`${signal} received. Shutting down IntellMeet...`)

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out.')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)

  forceExitTimer.unref()

  try {
    await new Promise((resolve) => {
      io.close(() => resolve())
    })

    if (httpServer.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }

    await mongoose.disconnect()

    clearTimeout(forceExitTimer)
    console.log('IntellMeet shut down cleanly.')
    process.exit(0)
  } catch (error) {
    clearTimeout(forceExitTimer)
    console.error('Shutdown failed:', error.message)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

startServer()
