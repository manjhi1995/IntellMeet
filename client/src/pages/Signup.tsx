
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setMessage('')
    setIsSuccess(false)

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setMessage('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setMessage('Account details are valid!')
    setIsSuccess(true)
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </div>

        <h1>Create your account</h1>

        <p className="auth-subtitle">
          Join IntellMeet and make your meetings smarter.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <label htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
          />

          {message && (
            <p className={isSuccess ? 'form-success' : 'form-error'}>
              {message}
            </p>
          )}

          <button type="submit" className="primary-btn">
            Create Account
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  )
}

export default Signup