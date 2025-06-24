// routes/auth.js
import express from 'express'
import jwt from 'jsonwebtoken'

const router = express.Router()

// TEMP dev-only login route to generate JWT token quickly
router.post('/dev-login', (req, res) => {
  // Accept userId and isAdmin flag from request body or use defaults
  const { userId = 'admin123', isAdmin = true } = req.body

  // Create a token with payload userId and isAdmin
  const token = jwt.sign(
    { userId, isAdmin },
    process.env.JWT_SECRET || 'King@2025', // Use your env secret or fallback
    { expiresIn: '1h' } // token expiry 1 hour
  )

  res.json({ token })
})

export default router
