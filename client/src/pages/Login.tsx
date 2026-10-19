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
    <main className="auth-page login-page">
      <nav className="login-navbar">
        <Link to="/" className="login-brand">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </Link>

        <Link to="/" className="login-back-home">
          ← Back to home
        </Link>
      </nav>

      <div className="login-layout">
        <section className="login-welcome">
          <div className="login-eyebrow">
            <span></span>
            YOUR TEAM, ONE CLICK AWAY
          </div>

          <h1>
            Great to have
            <br />
            you <span>back.</span>
          </h1>

          <p>
            Your conversations, your team, your next big idea.
            Sign in and pick up right where you left off.
          </p>

          <div className="login-benefits">
            <div>
              <span className="login-benefit-icon">✦</span>
              <span>Meet face-to-face, from anywhere</span>
            </div>

            <div>
              <span className="login-benefit-icon">↗</span>
              <span>Share ideas and collaborate in real time</span>
            </div>

            <div>
              <span className="login-benefit-icon">◎</span>
              <span>Keep your team connected</span>
            </div>
          </div>

          <div className="login-decoration" aria-hidden="true">
            <div className="login-orbit login-orbit-one"></div>
            <div className="login-orbit login-orbit-two"></div>
            <div className="login-orbit login-orbit-three"></div>
            <div className="login-orbit-center">✦</div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-heading">
            <div className="login-card-icon">✦</div>
            <h2>Welcome back</h2>
            <p>Enter your details to sign in to your account.</p>
          </div>

          <form className="auth-form login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <div className="login-password-heading">
              <label htmlFor="password">Password</label>
            </div>

            <div className="password-wrapper login-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {message && (
              <p
                className={isSuccess ? 'form-success' : 'form-error'}
                role="status"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              className="primary-btn login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in to IntellMeet'}
              {!isLoading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="login-divider">
            <span>NEW TO INTELLMEET?</span>
          </div>

          <p className="auth-footer login-signup-footer">
            Don't have an account?{' '}
            <Link to="/signup">Create an account</Link>
          </p>

          <p className="login-security-note">
            <span>●</span> Your team workspace is waiting for you.
          </p>
        </section>
      </div>

      <footer className="login-page-footer">
        <span>© {new Date().getFullYear()} IntellMeet</span>
        <span>Better conversations. Better collaboration.</span>
      </footer>
    </main>
  )
}

export default Login