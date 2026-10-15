import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../App.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setMessage('')
    setIsSuccess(false)

    if (!email.trim() || !password) {
      setMessage('Please enter your email and password.')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Login failed.')
        return
      }

      localStorage.setItem('token', data.token)

      setMessage('Login successful!')
      setIsSuccess(true)

      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } catch (error) {
      console.error('Login request failed:', error)

      setMessage(
        'Unable to connect to the server. Please make sure the backend is running.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </div>

        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Sign in to continue to your meetings.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>

          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>

          <div className="password-wrapper">

            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>

          </div>

          {message && (
            <p className={isSuccess ? 'form-success' : 'form-error'}>
              {message}
            </p>
          )}

          <button
            type="submit"
            className="primary-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>

        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/signup">
            Create an account
          </Link>
        </p>

      </div>
    </main>
  )
}

export default Login