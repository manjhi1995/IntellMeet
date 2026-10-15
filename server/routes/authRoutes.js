const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', (req, res) => {
  res.send('Authentication routes are working!')
})

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
      })
    }

    const existingUser = await User.findOne({ email })

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists.',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    })

    res.status(201).json({
      message: 'Signup successful!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Signup error:', error.message)

    res.status(500).json({
      message: 'Server error during signup.',
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password)

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d',
      }
    )

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error.message)

    res.status(500).json({
      message: 'Server error during login.',
    })
  }
})

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password')

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      })
    }

    res.json({
      message: 'Protected profile accessed successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Profile error:', error.message)

    res.status(500).json({
      message: 'Server error.',
    })
  }
})

module.exports = router