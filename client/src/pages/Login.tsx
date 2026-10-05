import '../App.css'

function Login() {
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

        <form className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
          />

          <button type="submit" className="primary-btn">
            Log In
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <a href="/signup">Create an account</a>
        </p>
      </div>
    </main>
  )
}

export default Login