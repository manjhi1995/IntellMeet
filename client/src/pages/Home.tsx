import '../App.css'
function Home() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="/login">Log in</a>
          <a href="/signup" className="signup-btn">
            Get Started
          </a>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <div className="badge">
            AI-Powered Meeting Intelligence
          </div>

          <h1>
            Meetings that work
            <span> smarter.</span>
          </h1>

          <p>
            IntellMeet brings video meetings, AI-powered transcription,
            intelligent summaries, action items, and team collaboration
            together in one powerful platform.
          </p>

          <div className="hero-buttons">
            <a href="/login" className="primary-btn">
              Start Meeting
            </a>

            <a href="#features" className="secondary-btn">
              Explore Features
            </a>
          </div>
        </div>

        <div className="hero-card">
          <div className="card-header">
            <div>
              <span className="live-dot"></span>
              Live Meeting
            </div>

            <span className="participants">
              12 participants
            </span>
          </div>

          <div className="video-grid">
            <div className="video-box">👤</div>
            <div className="video-box">👩</div>
            <div className="video-box">👨</div>
            <div className="video-box">🧑</div>
          </div>

          <div className="meeting-bar">
            <button>🎤</button>
            <button>📹</button>
            <button>🖥️</button>
            <button>💬</button>
            <button className="end-call">End</button>
          </div>
        </div>
      </main>

      <section className="features" id="features">
        <h2>Everything your team needs</h2>

        <p className="section-subtitle">
          One platform for smarter, more productive meetings.
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🎥</div>
            <h3>Video Meetings</h3>
            <p>
              High-quality meetings with screen sharing and real-time
              collaboration.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3>AI Intelligence</h3>
            <p>
              Automatic transcription, summaries, and action item
              extraction.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Team Collaboration</h3>
            <p>
              Chat, shared notes, tasks, and project collaboration in
              real time.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home