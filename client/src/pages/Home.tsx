
import '../App.css'

function Home() {
  return (
    <div className="app home-page">
      <nav className="navbar home-navbar">
        <a href="/" className="logo home-logo">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </a>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="/login" className="login-btn">
            Log in
          </a>
          <a href="/signup" className="signup-btn">
            Get Started <span aria-hidden="true">→</span>
          </a>
        </div>
      </nav>

      <main className="home-hero">
        <div className="home-hero-content">
          <div className="home-eyebrow">
            <span className="home-eyebrow-dot"></span>
            A BETTER WAY TO MEET
          </div>

          <h1>
            Bring your team
            <br />
            <span>closer together.</span>
          </h1>

          <p>
            Great ideas start with great conversations. Meet face-to-face,
            collaborate in real time, and make every conversation count
            with IntellMeet.
          </p>

          <div className="home-hero-buttons">
            <a href="/signup" className="home-primary-btn">
              Get started for free <span aria-hidden="true">→</span>
            </a>

            <a href="/login" className="home-secondary-btn">
              Join a meeting
            </a>
          </div>

          <div className="home-trust-note">
            <span className="home-trust-icon">✓</span>
            Simple to start. Easy to connect.
          </div>
        </div>

        <div className="home-visual">
          <div className="home-glow"></div>

          <div className="home-meeting-window">
            <div className="home-window-header">
              <div className="home-window-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="home-window-title">Team Sync</span>
              <span className="home-live-pill">
                <span></span> LIVE
              </span>
            </div>

            <div className="home-video-grid">
              <div className="home-video-tile home-tile-purple">
                <div className="home-avatar">JD</div>
                <span className="home-person-name">Jordan Davis</span>
                <span className="home-mic-status">🎤</span>
              </div>

              <div className="home-video-tile home-tile-blue">
                <div className="home-avatar">AM</div>
                <span className="home-person-name">Alex Morgan</span>
                <span className="home-mic-status">🎤</span>
              </div>

              <div className="home-video-tile home-tile-pink">
                <div className="home-avatar">SK</div>
                <span className="home-person-name">Sam Kim</span>
                <span className="home-mic-status">🎤</span>
              </div>

              <div className="home-video-tile home-tile-green">
                <div className="home-avatar">TY</div>
                <span className="home-person-name">Taylor Young</span>
                <span className="home-mic-status">🎤</span>
              </div>
            </div>

            <div className="home-call-controls">
              <span className="home-call-time">●  24:18</span>
              <div className="home-call-actions">
                <span>🎤</span>
                <span>📹</span>
                <span>▣</span>
                <span>💬</span>
                <span className="home-call-end">☎</span>
              </div>
            </div>
          </div>

          <div className="home-floating-card">
            <span className="home-floating-icon">✦</span>
            <div>
              <strong>Better together</strong>
              <p>Ideas flow here.</p>
            </div>
          </div>
        </div>
      </main>

      <section className="home-benefits" id="about">
        <div>
          <span className="home-benefit-symbol">✦</span>
          <span>Built for teamwork</span>
        </div>
        <div>
          <span className="home-benefit-symbol">◎</span>
          <span>Connect from anywhere</span>
        </div>
        <div>
          <span className="home-benefit-symbol">↗</span>
          <span>Make conversations count</span>
        </div>
      </section>

      <section className="features home-features" id="features">
        <div className="home-section-label">WHY INTELLMEET</div>

        <h2>Everything clicks when you connect.</h2>

        <p className="section-subtitle">
          The tools you need to bring people together and keep work moving.
        </p>

        <div className="feature-grid">
          <div className="feature-card home-feature-card">
            <div className="feature-icon home-feature-icon home-feature-purple">
              <span>▣</span>
            </div>
            <h3>Face-to-face meetings</h3>
            <p>
              Connect with your team through video meetings designed
              to make conversations feel natural.
            </p>
          </div>

          <div className="feature-card home-feature-card">
            <div className="feature-icon home-feature-icon home-feature-blue">
              <span>↗</span>
            </div>
            <h3>Share and collaborate</h3>
            <p>
              Share your screen, exchange ideas, and work through
              important details together.
            </p>
          </div>

          <div className="feature-card home-feature-card">
            <div className="feature-icon home-feature-icon home-feature-pink">
              <span>💬</span>
            </div>
            <h3>Real-time team chat</h3>
            <p>
              Keep conversations going with meeting chat and make
              it easier for everyone to stay connected.
            </p>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div>
          <span className="home-section-label">YOUR NEXT GREAT MEETING</span>
          <h2>Good things happen when teams connect.</h2>
          <p>Create your account and bring your next conversation to IntellMeet.</p>
        </div>

        <a href="/signup" className="home-primary-btn">
          Get started <span aria-hidden="true">→</span>
        </a>
      </section>

      <footer className="home-footer">
        <a href="/" className="logo home-logo">
          <span className="logo-icon">✦</span>
          <span>IntellMeet</span>
        </a>
        <p>Better conversations. Better collaboration.</p>
        <span>© {new Date().getFullYear()} IntellMeet</span>
      </footer>
    </div>
  )
}

export default Home
