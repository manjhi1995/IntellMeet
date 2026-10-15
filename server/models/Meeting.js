const mongoose = require('mongoose')

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    meetingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
  }
)

const Meeting = mongoose.model('Meeting', meetingSchema)

module.exports = Meeting