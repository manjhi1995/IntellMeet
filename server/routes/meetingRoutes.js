
const express = require('express')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Meeting = require('../models/Meeting')
const Message = require('../models/Message')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

// Normalize meeting codes so URLs containing a CODE prefix also work.
const normalizeMeetingCode = (value) => {
  if (typeof value !== 'string') return ''

  return value.trim().replace(/^CODE/i, '').trim().toLowerCase()
}

const getTodayDateInIndia = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year').value
  const month = parts.find((part) => part.type === 'month').value
  const day = parts.find((part) => part.type === 'day').value

  return `${year}-${month}-${day}`
}

// Create a meeting.
router.post('/', protect, async (req, res) => {
  try {
    const { title, scheduledAt } = req.body

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Meeting title is required.' })
    }

    let parsedScheduledAt = null

    if (scheduledAt !== undefined && scheduledAt !== null && scheduledAt !== '') {
      parsedScheduledAt = new Date(scheduledAt)

      if (Number.isNaN(parsedScheduledAt.getTime())) {
        return res.status(400).json({
          message: 'Please provide a valid meeting date and time.',
        })
      }

      if (parsedScheduledAt.getTime() <= Date.now()) {
        return res.status(400).json({
          message: 'Meeting date and time must be in the future.',
        })
      }
    }

    const meeting = await Meeting.create({
      title: title.trim(),
      meetingCode: crypto.randomBytes(4).toString('hex'),
      host: req.user.userId,
      scheduledAt: parsedScheduledAt,
      status: 'scheduled',
    })

    return res.status(201).json({
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
    return res.status(500).json({
      message: 'Server error while creating meeting.',
    })
  }
})

// Get meetings hosted by the authenticated user.
router.get('/', protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      host: req.user.userId,
    }).sort({ createdAt: -1 })

    return res.json({ meetings })
  } catch (error) {
    console.error('Get meetings error:', error.message)
    return res.status(500).json({
      message: 'Server error while fetching meetings.',
    })
  }
})

// Get shared notes and action items.
router.get('/:meetingCode/collaboration', protect, async (req, res) => {
  try {
    const meetingCode = normalizeMeetingCode(req.params.meetingCode)

    const meeting = await Meeting.findOne({ meetingCode })
      .select('title meetingCode host status notes actionItems')

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' })
    }

    return res.json({
      meeting: {
        title: meeting.title,
        meetingCode: meeting.meetingCode,
        status: meeting.status,
        notes: meeting.notes,
        actionItems: meeting.actionItems,
      },
    })
  } catch (error) {
    console.error('Get collaboration data error:', error.message)
    return res.status(500).json({
      message: 'Server error while fetching collaboration data.',
    })
  }
})

// Save shared notes.
router.put('/:meetingCode/notes', protect, async (req, res) => {
  try {
    const meetingCode = normalizeMeetingCode(req.params.meetingCode)
    const { notes } = req.body

    if (typeof notes !== 'string' || notes.length > 20000) {
      return res.status(400).json({
        message: 'Notes must be text containing at most 20000 characters.',
      })
    }

    const meeting = await Meeting.findOneAndUpdate(
      { meetingCode },
      { $set: { notes } },
      { new: true, runValidators: true }
    ).select('meetingCode notes status')

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' })
    }

    return res.json({
      message: 'Shared notes saved successfully.',
      notes: meeting.notes,
    })
  } catch (error) {
    console.error('Save meeting notes error:', error.message)
    return res.status(500).json({
      message: 'Server error while saving meeting notes.',
    })
  }
})

// Add an action item.
router.post('/:meetingCode/action-items', protect, async (req, res) => {
  try {
    const meetingCode = normalizeMeetingCode(req.params.meetingCode)
    const { title, assignedTo = '', dueDate = null } = req.body

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return res.status(400).json({
        message: 'Action item title is required and must be at most 200 characters.',
      })
    }

    if (typeof assignedTo !== 'string' || assignedTo.length > 100) {
      return res.status(400).json({
        message: 'Assignee must be text containing at most 100 characters.',
      })
    }

    let parsedDueDate = null

    if (dueDate !== null && dueDate !== '') {
      if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        const [year, month, day] = dueDate.split('-').map(Number)
        const checkDate = new Date(Date.UTC(year, month - 1, day))

        if (
          checkDate.getUTCFullYear() !== year ||
          checkDate.getUTCMonth() !== month - 1 ||
          checkDate.getUTCDate() !== day
        ) {
          return res.status(400).json({
            message: 'Please provide a valid due date.',
          })
        }

        if (dueDate < getTodayDateInIndia()) {
          return res.status(400).json({
            message: 'Due date cannot be in the past.',
          })
        }

        parsedDueDate = new Date(`${dueDate}T00:00:00.000Z`)
      } else {
        parsedDueDate = new Date(dueDate)

        if (Number.isNaN(parsedDueDate.getTime())) {
          return res.status(400).json({
            message: 'Please provide a valid due date.',
          })
        }

        const formattedDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(parsedDueDate)

        if (formattedDate < getTodayDateInIndia()) {
          return res.status(400).json({
            message: 'Due date cannot be in the past.',
          })
        }
      }
    }

    const actionItem = {
      _id: new mongoose.Types.ObjectId(),
      title: title.trim(),
      assignedTo: assignedTo.trim(),
      dueDate: parsedDueDate,
      completed: false,
      createdBy: String(req.user.userId),
    }

    const meeting = await Meeting.findOneAndUpdate(
      { meetingCode },
      { $push: { actionItems: actionItem } },
      { new: true, runValidators: true }
    ).select('meetingCode actionItems')

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' })
    }

    return res.status(201).json({
      message: 'Action item added successfully.',
      actionItem: meeting.actionItems.id(actionItem._id),
    })
  } catch (error) {
    console.error('Add action item error:', error.message)
    return res.status(500).json({
      message: 'Server error while adding the action item.',
    })
  }
})

// Update an action item's completion status.
router.patch(
  '/:meetingCode/action-items/:actionItemId',
  protect,
  async (req, res) => {
    try {
      const meetingCode = normalizeMeetingCode(req.params.meetingCode)
      const { actionItemId } = req.params
      const { completed } = req.body

      if (!mongoose.isValidObjectId(actionItemId)) {
        return res.status(400).json({ message: 'Invalid action item ID.' })
      }

      if (typeof completed !== 'boolean') {
        return res.status(400).json({
          message: 'Completed must be true or false.',
        })
      }

      const meeting = await Meeting.findOneAndUpdate(
        {
          meetingCode,
          'actionItems._id': actionItemId,
        },
        { $set: { 'actionItems.$.completed': completed } },
        { new: true, runValidators: true }
      ).select('meetingCode actionItems')

      if (!meeting) {
        return res.status(404).json({
          message: 'Meeting or action item not found.',
        })
      }

      return res.json({
        message: 'Action item updated successfully.',
        actionItem: meeting.actionItems.id(actionItemId),
      })
    } catch (error) {
      console.error('Update action item error:', error.message)
      return res.status(500).json({
        message: 'Server error while updating the action item.',
      })
    }
  }
)

// Delete an action item from MongoDB.
router.delete(
  '/:meetingCode/action-items/:actionItemId',
  protect,
  async (req, res) => {
    try {
      const meetingCode = normalizeMeetingCode(req.params.meetingCode)
      const { actionItemId } = req.params

      if (!mongoose.isValidObjectId(actionItemId)) {
        return res.status(400).json({
          message: 'Invalid action item ID.',
        })
      }

      const meeting = await Meeting.findOneAndUpdate(
        {
          meetingCode,
          'actionItems._id': actionItemId,
        },
        {
          $pull: {
            actionItems: { _id: actionItemId },
          },
        },
        { new: true, runValidators: true }
      ).select('meetingCode actionItems')

      if (!meeting) {
        return res.status(404).json({
          message: 'Meeting or action item not found.',
        })
      }

      return res.json({
        message: 'Action item deleted successfully.',
        actionItems: meeting.actionItems,
      })
    } catch (error) {
      console.error('Delete action item error:', error.message)
      return res.status(500).json({
        message: 'Server error while deleting the action item.',
      })
    }
  }
)

// Only the authenticated host can officially end a meeting.
router.post('/:meetingCode/end', protect, async (req, res) => {
  try {
    const meetingCode = normalizeMeetingCode(req.params.meetingCode)
    const meeting = await Meeting.findOne({ meetingCode })

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' })
    }

    if (String(meeting.host) !== String(req.user.userId)) {
      return res.status(403).json({
        message: 'Only the meeting host can end this meeting.',
      })
    }

    if (meeting.status !== 'ended') {
      meeting.status = 'ended'
      await meeting.save()
    }

    await Message.deleteMany({ meetingCode })

    const io = req.app.get('io')

    if (io) {
      io.to(meetingCode).emit('meeting-ended', {
        meetingCode,
        message: 'The host has ended this meeting.',
      })

      await io.in(meetingCode).socketsLeave(meetingCode)
    }

    return res.status(200).json({
      message: 'Meeting ended successfully. Chat history deleted.',
      meetingCode,
      status: meeting.status,
    })
  } catch (error) {
    console.error('End meeting error:', error.message)
    return res.status(500).json({
      message: 'Server error while ending the meeting.',
    })
  }
})

module.exports = router
