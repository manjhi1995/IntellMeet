
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const passwordStrength =
    password.length === 0
      ? ''
      : password.length < 6
        ? 'Weak'
        : password.length < 10
          ? 'Medium'
          : 'Strong'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Signup failed.')
        return
      }

      setMessage('Account created successfully!')
      setIsSuccess(true)

      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Signup request failed:', error)
      setMessage(
        'Unable to connect to the server. Please make sure the backend is running.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-page signup-page">
      <nav className="signup-navbar">
        <Link to="/" className="signup-brand">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </Link>

        <Link to="/" className="signup-back-home">
          ← Back to home
        </Link>
      </nav>

      <div className="signup-layout">
        <section className="signup-welcome">
          <div className="signup-eyebrow">
            <span></span>
            YOUR NEXT CONVERSATION STARTS HERE
          </div>

          <h1>
            Bring your
            <br />
            team <span>closer.</span>
          </h1>

          <p>
            Create your IntellMeet account and bring your conversations,
            ideas, and team collaboration together in one place.
          </p>

          <div className="signup-benefits">
            <div>
              <span className="signup-benefit-icon">✦</span>
              <span>Start connecting with your team</span>
            </div>

            <div>
              <span className="signup-benefit-icon">↗</span>
              <span>Collaborate and share ideas in real time</span>
            </div>

            <div>
              <span className="signup-benefit-icon">◎</span>
              <span>Make every meeting count</span>
            </div>
          </div>

          <div className="signup-decoration" aria-hidden="true">
            <div className="signup-orbit signup-orbit-one"></div>
            <div className="signup-orbit signup-orbit-two"></div>
            <div className="signup-orbit signup-orbit-three"></div>
            <div className="signup-orbit-center">✦</div>
          </div>
        </section>

        <section className="signup-card">
          <div className="signup-card-heading">
            <div className="signup-card-icon">✦</div>
            <h2>Create your account</h2>
            <p>Get started with IntellMeet in just a few steps.</p>
          </div>

          <form className="auth-form signup-form" onSubmit={handleSubmit}>
            <label htmlFor="name">Full name</label>

            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

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

            <label htmlFor="password">Password</label>

            <div className="password-wrapper signup-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                autoComplete="new-password"
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

            {passwordStrength && (
              <div className="signup-strength">
                <div className="signup-strength-track">
                  <span className={`signup-strength-fill ${passwordStrength.toLowerCase()}`}></span>
                </div>
                <p className={`password-strength ${passwordStrength.toLowerCase()}`}>
                  Password strength: <strong>{passwordStrength}</strong>
                </p>
              </div>
            )}

            <label htmlFor="confirmPassword">Confirm password</label>

            <div className="password-wrapper signup-password-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Enter your password again"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
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
              className="primary-btn signup-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create your account'}
              {!isLoading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="signup-divider">
            <span>ALREADY A MEMBER?</span>
          </div>

          <p className="auth-footer signup-login-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>

          <p className="signup-security-note">
            <span>●</span> Your team journey starts here.
          </p>
        </section>
      </div>

      <footer className="signup-page-footer">
        <span>© {new Date().getFullYear()} IntellMeet</span>
        <span>Better conversations. Better collaboration.</span>
      </footer>
    </main>
  )
}

export default Signup
