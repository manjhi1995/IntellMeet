
const mongoose = require('mongoose')

const actionItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    assignedTo: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
)

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
    notes: {
      type: String,
      default: '',
      maxlength: 20000,
    },
    actionItems: {
      type: [actionItemSchema],
      default: [],
    },
  },
  { timestamps: true }
)

const Meeting = mongoose.model('Meeting', meetingSchema)

module.exports = Meeting
