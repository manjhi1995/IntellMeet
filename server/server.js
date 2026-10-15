require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')

const authRoutes = require('./routes/authRoutes')
const meetingRoutes = require('./routes/meetingRoutes')
const connectDB = require('./config/db')

const app = express()
const httpServer = http.createServer(app)

const PORT = 5000
const CLIENT_URL = 'http://localhost:5173'
const MAX_PARTICIPANTS = 2

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

app.use(cors({ origin: CLIENT_URL }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/meetings', meetingRoutes)

app.get('/', (req, res) => {
  res.status(200).send('IntellMeet backend is running!')
})

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    server: 'running',
  })
})

const isValidMeetingCode = (code) => {
  return (
    typeof code === 'string' &&
    code.trim().length > 0 &&
    code.trim().length <= 64
  )
}

const isValidRoomPayload = (payload, socket) => {
  return (
    payload &&
    typeof payload.room === 'string' &&
    socket.data.meetingRooms.has(payload.room.trim())
  )
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  socket.data.meetingRooms = new Set()

  socket.on('join-room', async (meetingCode) => {
    try {
      if (!isValidMeetingCode(meetingCode)) {
        socket.emit('join-error', 'Invalid meeting code.')
        return
      }

      const roomName = meetingCode.trim()

      // Prevent duplicate joins to the same room.
      if (socket.data.meetingRooms.has(roomName)) {
        return
      }

      // Keep each socket in only one meeting at a time.
      if (socket.data.meetingRooms.size > 0) {
        socket.emit(
          'join-error',
          'Leave your current meeting before joining another.'
        )
        return
      }

      const room = io.sockets.adapter.rooms.get(roomName)
      const participantCount = room ? room.size : 0

      if (participantCount >= MAX_PARTICIPANTS) {
        socket.emit('room-full')
        return
      }

      await socket.join(roomName)
      socket.data.meetingRooms.add(roomName)

      socket.emit('room-joined', {
        isInitiator: participantCount === 0,
      })

      socket.to(roomName).emit('peer-joined')

      console.log(
        `Socket ${socket.id} joined meeting ${roomName}`
      )
    } catch (error) {
      console.error('Join room failed:', error.message)
      socket.emit('join-error', 'Unable to join this meeting.')
    }
  })

  socket.on('offer', (payload = {}) => {
    if (!isValidRoomPayload(payload, socket)) {
      return
    }

    const { offer } = payload

    if (
      !offer ||
      typeof offer !== 'object' ||
      typeof offer.type !== 'string' ||
      typeof offer.sdp !== 'string'
    ) {
      return
    }

    socket.to(payload.room.trim()).emit('offer', offer)
  })

  socket.on('answer', (payload = {}) => {
    if (!isValidRoomPayload(payload, socket)) {
      return
    }

    const { answer } = payload

    if (
      !answer ||
      typeof answer !== 'object' ||
      typeof answer.type !== 'string' ||
      typeof answer.sdp !== 'string'
    ) {
      return
    }

    socket.to(payload.room.trim()).emit('answer', answer)
  })

  socket.on('ice-candidate', (payload = {}) => {
    if (!isValidRoomPayload(payload, socket)) {
      return
    }

    const { candidate } = payload

    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof candidate.candidate !== 'string'
    ) {
      return
    }

    socket
      .to(payload.room.trim())
      .emit('ice-candidate', candidate)
  })

  socket.on('leave-room', (meetingCode) => {
    if (!isValidMeetingCode(meetingCode)) {
      return
    }

    const roomName = meetingCode.trim()

    if (!socket.data.meetingRooms.has(roomName)) {
      return
    }

    socket.to(roomName).emit('peer-left')

    socket.leave(roomName)
    socket.data.meetingRooms.delete(roomName)

    console.log(
      `Socket ${socket.id} left meeting ${roomName}`
    )
  })

  socket.on('disconnecting', () => {
    for (const roomName of socket.data.meetingRooms) {
      socket.to(roomName).emit('peer-left')
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(
      `Socket disconnected: ${socket.id} (${reason})`
    )

    socket.data.meetingRooms.clear()
  })

  socket.on('error', (error) => {
    console.error('Socket error:', error.message)
  })
})

async function startServer() {
  try {
    await connectDB()

    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error(
      'Failed to connect to MongoDB:',
      error.message
    )

    process.exit(1)
  }
}

startServer()