
const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)

    console.log('MongoDB connected successfully!')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    console.error('Error name:', error.name, '| Code:', error.code || 'N/A')
    console.error('Full MongoDB error:', error)

    if (error.reason?.servers) {
      for (const [address, server] of error.reason.servers) {
        console.error(
          `Node ${address}:`,
          server.error?.message || server.type
        )
      }
    }

    process.exit(1)
  }
}

module.exports = connectDB
