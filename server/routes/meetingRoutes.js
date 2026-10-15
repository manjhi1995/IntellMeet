const express = require('express')
const crypto = require('crypto')
const Meeting = require('../models/Meeting')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/', protect, async (req, res) => {
  try {
    const { title, scheduledAt } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Meeting title is required.',
      })
    }

    const meetingCode = crypto.randomBytes(4).toString('hex')

    const meeting = await Meeting.create({
      title: title.trim(),
      meetingCode,
      host: req.user.userId,
      scheduledAt: scheduledAt || null,
      status: 'scheduled',
    })

    res.status(201).json({
      message: 'Meeting created successfully!',
      meeting: {
        id: meeting._id,
        title: meeting.title,
        meetingCode: meeting.meetingCode,
        host: meeting.host,
        scheduledAt: meeting.scheduledAt,
        status: meeting.status,
      },
    })
  } catch (error) {
    console.error('Create meeting error:', error.message)

    res.status(500).json({
      message: 'Server error while creating meeting.',
    })
  }
})

router.get('/', protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      host: req.user.userId,
    }).sort({ createdAt: -1 })

    res.json({
      meetings,
    })
  } catch (error) {
    console.error('Get meetings error:', error.message)

    res.status(500).json({
      message: 'Server error while fetching meetings.',
    })
  }
})

module.exports = router