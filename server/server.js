
require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')

const authRoutes = require('./routes/authRoutes')
const meetingRoutes = require('./routes/meetingRoutes')
const connectDB = require('./config/db')
const Meeting = require('./models/Meeting')
const Message = require('./models/Message')

const app = express()
const httpServer = http.createServer(app)

const PORT = process.env.PORT || 5000
const CLIENT_URL = 'http://localhost:5173'
const MAX_PARTICIPANTS = 2

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

app.set('io', io)

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
      })

      if (!meeting) {
        socket.emit('join-error', 'Meeting not found.')
        return
      }

      if (meeting.status === 'ended') {
        socket.emit('join-error', 'This meeting has already ended.')
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

      // Only change scheduled to active if it is still scheduled.
      // This prevents a concurrent join from overwriting "ended".
      await Meeting.updateOne(
        {
          meetingCode: roomName,
          status: 'scheduled',
        },
        {
          $set: { status: 'active' },
        }
      )

      // Recheck after joining in case the host ended the meeting meanwhile.
      meeting = await Meeting.findOne({
        meetingCode: roomName,
      })

      if (!meeting || meeting.status === 'ended') {
        await socket.leave(roomName)
        socket.data.meetingRooms.delete(roomName)
        socket.emit('join-error', 'This meeting has already ended.')
        return
      }

      const history = await Message.find({
        meetingCode: roomName,
      })
        .sort({ createdAt: 1 })
        .limit(500)
        .lean()

      // Check again before sending history to the joining client.
      const latestMeeting = await Meeting.findOne({
        meetingCode: roomName,
      }).select('status')

      if (!latestMeeting || latestMeeting.status === 'ended') {
        await socket.leave(roomName)
        socket.data.meetingRooms.delete(roomName)
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
        isInitiator: participantCount === 0,
      })

      socket.to(roomName).emit('peer-joined')

      console.log(`Socket ${socket.id} joined meeting ${roomName}`)
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

    socket.to(payload.room.trim()).emit('ice-candidate', candidate)
  })

  // Save each valid chat message before broadcasting it.
  // Recheck the meeting after saving to prevent leftover messages
  // when a chat save races with the host ending the meeting.
  socket.on('chat-message', async (payload = {}) => {
    let savedMessage = null

    try {
      if (!isValidRoomPayload(payload, socket)) {
        socket.emit('chat-error', {
          message: 'You must join the meeting before sending messages.',
        })
        return
      }

      const roomName = payload.room.trim()

      if (typeof payload.message !== 'string') {
        socket.emit('chat-error', {
          message: 'Invalid message.',
        })
        return
      }

      const message = payload.message.trim()

      if (!message || message.length > 1000) {
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

      // Critical second check: the host may have ended the meeting
      // between the first status check and the database save.
      const latestMeeting = await Meeting.findOne({
        meetingCode: roomName,
        status: { $ne: 'ended' },
      }).select('_id')

      if (!latestMeeting) {
        await Message.deleteOne({
          _id: savedMessage._id,
          meetingCode: roomName,
        })

        console.log(
          `Removed a late chat message from ended meeting ${roomName}`
        )

        socket.emit('chat-error', {
          message: 'This meeting has ended. Your message was not delivered.',
        })
        return
      }

      const chatMessage = {
        senderId: savedMessage.senderId,
        message: savedMessage.message,
        timestamp: savedMessage.createdAt.toISOString(),
      }

      io.to(roomName).emit('chat-message', chatMessage)

      console.log(`Chat message saved and delivered in meeting ${roomName}`)
    } catch (error) {
      console.error('Save chat message failed:', error.message)

      // Best-effort cleanup if a saved message encountered an error
      // while the meeting was being ended.
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
          console.error(
            'Late message cleanup failed:',
            cleanupError.message
          )
        }
      }

      socket.emit('chat-error', {
        message: 'Unable to save your message. Please try again.',
      })
    }
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

    // Do not delete chat history when a participant leaves.
    console.log(`Socket ${socket.id} left meeting ${roomName}`)
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

    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

startServer()
