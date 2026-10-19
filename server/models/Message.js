
const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    meetingCode: {
      type: String,
      required: true,
      trim: true,
    },

    senderId: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
)

messageSchema.index({ meetingCode: 1, createdAt: 1 })

const Message = mongoose.model('Message', messageSchema)

module.exports = Message
