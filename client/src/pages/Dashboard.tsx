import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type User = {
  id: string
  name: string
  email: string
}

type Meeting = {
  id: string
  _id?: string
  title: string
  meetingCode: string
  status: string
  scheduledAt: string | null
}

type ApiResponse = {
  message?: string
  user?: User
  meetings?: Meeting[]
  meeting?: Meeting
}

const readResponse = async (
  response: Response
): Promise<ApiResponse> => {
  try {
    const data: unknown = await response.json()

    if (data && typeof data === 'object') {
      return data as ApiResponse
    }

    return {}
  } catch {
    return {}
  }
}

const getErrorMessage = (
  data: ApiResponse,
  fallback: string
) => {
  return typeof data.message === 'string' && data.message.trim()
    ? data.message
    : fallback
}

const getLocalDateTimeValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16)
}

function Dashboard() {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const [profileResponse, meetingsResponse] =
          await Promise.all([
            fetch('http://localhost:5000/api/auth/profile', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }),
            fetch('http://localhost:5000/api/meetings', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }),
          ])

        const profileData = await readResponse(profileResponse)
        const meetingsData = await readResponse(meetingsResponse)

        if (!isMounted) return

        if (
          profileResponse.status === 401 ||
          profileResponse.status === 403 ||
          meetingsResponse.status === 401 ||
          meetingsResponse.status === 403
        ) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }

        if (!profileResponse.ok || !profileData.user) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }

        setUser(profileData.user)

        if (!meetingsResponse.ok) {
          setMessage(
            getErrorMessage(
              meetingsData,
              'Unable to load meetings.'
            )
          )
          return
        }

        setMeetings(
          Array.isArray(meetingsData.meetings)
            ? meetingsData.meetings
            : []
        )
      } catch (error) {
        console.error('Dashboard request failed:', error)

        if (isMounted) {
          setMessage('Unable to connect to the server.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const handleCreateMeeting = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (isCreating) return

    setMessage('')
    setIsSuccess(false)

    const meetingTitle = title.trim()

    if (!meetingTitle) {
      setMessage('Please enter a meeting title.')
      return
    }

    if (meetingTitle.length > 120) {
      setMessage('Meeting title cannot exceed 120 characters.')
      return
    }

    if (scheduledAt) {
      const selectedDate = new Date(scheduledAt)

      if (Number.isNaN(selectedDate.getTime())) {
        setMessage('Please select a valid meeting date and time.')
        return
      }

      if (selectedDate.getTime() < Date.now()) {
        setMessage('Meeting date and time cannot be in the past.')
        return
      }
    }

    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch(
        'http://localhost:5000/api/meetings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: meetingTitle,
            scheduledAt: scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
          }),
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token')
        navigate('/login', { replace: true })
        return
      }

      if (!response.ok) {
        setMessage(
          getErrorMessage(data, 'Failed to create meeting.')
        )
        return
      }

      if (!data.meeting || !data.meeting.meetingCode) {
        setMessage(
          'The server response did not include the meeting code. Please refresh your meetings list.'
        )
        return
      }

      const newMeeting = data.meeting

      setMeetings((previousMeetings) => [
        newMeeting,
        ...previousMeetings.filter(
          (meeting) =>
            (meeting.id || meeting._id) !==
            (newMeeting.id || newMeeting._id)
        ),
      ])

      setMessage('Meeting created successfully!')
      setIsSuccess(true)
      setTitle('')
      setScheduledAt('')
    } catch (error) {
      console.error('Create meeting request failed:', error)
      setMessage('Unable to connect to the server.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinMeeting = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    const code = joinCode.trim()

    if (!code) {
      setMessage('Please enter a meeting code.')
      setIsSuccess(false)
      return
    }

    setMessage('')
    setIsSuccess(false)

    navigate(`/meeting/${encodeURIComponent(code)}`)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled'

    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Date unavailable'
    }

    return parsedDate.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  if (isLoading) {
    return (
      <main className="dashboard-page dashboard-loading">
        <div className="dashboard-loader" />
        <p>Preparing your workspace...</p>
      </main>
    )
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <button
          className="dashboard-brand"
          type="button"
          onClick={() => navigate('/dashboard')}
        >
          <span className="dashboard-brand-icon">I</span>
          <span>
            Intell<span>Meet</span>
          </span>
        </button>

        <div className="dashboard-topbar-right">
          <span className="dashboard-online">
            <span />
            Workspace
          </span>

          <div className="dashboard-user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <button
            className="dashboard-logout"
            type="button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
            <h1>
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h1>
            <p className="dashboard-subtitle">
              Bring your team together. Your next great conversation
              starts here.
            </p>
            {user?.email && (
              <p className="dashboard-user-email">{user.email}</p>
            )}
          </div>

          <div className="dashboard-welcome-art" aria-hidden="true">
            <div className="dashboard-art-orbit dashboard-art-orbit-one" />
            <div className="dashboard-art-orbit dashboard-art-orbit-two" />
            <div className="dashboard-art-card">
              <span>✦</span>
              <strong>Better meetings.</strong>
              <small>Stronger connections.</small>
            </div>
          </div>
        </section>

        <section className="dashboard-stats">
          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon stat-purple">▣</div>
            <div>
              <p>Total meetings</p>
              <h2>{meetings.length}</h2>
              <span>In your workspace</span>
            </div>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon stat-blue">◷</div>
            <div>
              <p>Scheduled</p>
              <h2>
                {meetings.filter((meeting) => meeting.scheduledAt).length}
              </h2>
              <span>With a date and time</span>
            </div>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon stat-green">✓</div>
            <div>
              <p>Quick access</p>
              <h2>Ready</h2>
              <span>Create or join a call</span>
            </div>
          </article>
        </section>

        {message && (
          <div
            className={`dashboard-alert ${
              isSuccess ? 'dashboard-success' : 'dashboard-error'
            }`}
            role="status"
          >
            <span>{isSuccess ? '✓' : '!'}</span>
            {message}
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setMessage('')}
            >
              ×
            </button>
          </div>
        )}

        <section className="dashboard-actions-grid">
          <article className="dashboard-panel dashboard-create-panel">
            <div className="dashboard-panel-heading">
              <div className="dashboard-heading-icon">＋</div>
              <div>
                <h2>Create a meeting</h2>
                <p>Set up a space for your next conversation.</p>
              </div>
            </div>

            <form onSubmit={handleCreateMeeting}>
              <div className="dashboard-field">
                <label htmlFor="meetingTitle">Meeting name</label>
                <input
                  id="meetingTitle"
                  type="text"
                  placeholder="e.g. Weekly team sync"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              <div className="dashboard-field">
                <label htmlFor="scheduledAt">
                  Date and time <span>Optional</span>
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(event.target.value)
                  }
                  min={getLocalDateTimeValue(new Date())}
                />
              </div>

              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? 'Creating meeting...' : '＋ Create meeting'}
              </button>
            </form>
          </article>

          <article className="dashboard-panel dashboard-join-panel">
            <div className="dashboard-panel-heading">
              <div className="dashboard-heading-icon join-icon">↗</div>
              <div>
                <h2>Join a meeting</h2>
                <p>Already have an invitation? Join in seconds.</p>
              </div>
            </div>

            <div className="dashboard-join-illustration" aria-hidden="true">
              <div className="dashboard-join-avatar">IM</div>
              <div className="dashboard-join-line">
                <span />
                <span />
                <span />
              </div>
              <div className="dashboard-join-check">✓</div>
            </div>

            <form onSubmit={handleJoinMeeting}>
              <div className="dashboard-field">
                <label htmlFor="joinMeetingCode">Meeting code</label>
                <input
                  id="joinMeetingCode"
                  type="text"
                  placeholder="Enter your meeting code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <button className="dashboard-secondary-button" type="submit">
                Join meeting <span>→</span>
              </button>
            </form>
          </article>
        </section>

        <section className="dashboard-meetings-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">STAY CONNECTED</p>
              <h2>Your meetings</h2>
              <p>Manage your meetings and jump back into a conversation.</p>
            </div>

            <span className="dashboard-meeting-count">
              {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
            </span>
          </div>

          {meetings.length === 0 ? (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-icon">▣</div>
              <h3>Your meeting space awaits</h3>
              <p>
                Create your first meeting and invite people to connect.
              </p>
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={() =>
                  document.getElementById('meetingTitle')?.focus()
                }
              >
                Create your first meeting
              </button>
            </div>
          ) : (
            <div className="dashboard-meetings-list">
              {meetings.map((meeting) => (
                <article
                  className="dashboard-meeting-card"
                  key={meeting.id || meeting._id || meeting.meetingCode}
                >
                  <div className="dashboard-meeting-icon">▣</div>

                  <div className="dashboard-meeting-details">
                    <h3>{meeting.title}</h3>
                    <p>
                      <span className="dashboard-meeting-code-label">
                        CODE
                      </span>
                      <span className="dashboard-code-value">
                        {meeting.meetingCode}
                      </span>
                    </p>
                    <p className="dashboard-meeting-date">
                      ◷ {formatDate(meeting.scheduledAt)}
                    </p>
                  </div>

                  <div className="dashboard-meeting-meta">
                    <span
                      className={`dashboard-status ${
                        meeting.status?.toLowerCase() === 'active'
                          ? 'status-active'
                          : 'status-default'
                      }`}
                    >
                      <span />
                      {meeting.status || 'Created'}
                    </span>

                    <button
                      className="dashboard-meeting-join"
                      type="button"
                      onClick={() =>
                        navigate(
                          `/meeting/${encodeURIComponent(meeting.meetingCode)}`
                        )
                      }
                    >
                      Join <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>© {new Date().getFullYear()} IntellMeet</span>
          <span>Made for better conversations.</span>
        </footer>
      </div>
    </main>
  )
}

export default Dashboard