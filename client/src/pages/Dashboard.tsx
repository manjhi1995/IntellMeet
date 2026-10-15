
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type User = {
  id: string
  name: string
  email: string
}

type Meeting = {
  id: string
  title: string
  meetingCode: string
  status: string
  scheduledAt: string | null
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
    const loadDashboard = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        navigate('/login')
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

        const profileData = await profileResponse.json()
        const meetingsData = await meetingsResponse.json()

        if (!profileResponse.ok) {
          localStorage.removeItem('token')
          navigate('/login')
          return
        }

        if (!meetingsResponse.ok) {
          setMessage(
            meetingsData.message || 'Unable to load meetings.'
          )
          return
        }

        setUser(profileData.user)
        setMeetings(meetingsData.meetings)
      } catch (error) {
        console.error('Dashboard request failed:', error)
        setMessage('Unable to connect to the server.')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [navigate])

  const handleCreateMeeting = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setMessage('')
    setIsSuccess(false)

    if (!title.trim()) {
      setMessage('Please enter a meeting title.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
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
            title: title.trim(),
            scheduledAt: scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Failed to create meeting.')
        return
      }

      setMeetings((previousMeetings) => [
        data.meeting,
        ...previousMeetings,
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
    event: React.FormEvent<HTMLFormElement>
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
    navigate('/login')
  }

  if (isLoading) {
    return (
      <main className="dashboard-page">
        <p>Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="dashboard-page">
      <h1 className="dashboard-title">IntellMeet Dashboard</h1>

      {user && (
        <section>
          <h2>Welcome, {user.name}!</h2>
          <p>Email: {user.email}</p>
        </section>
      )}

      <section>
        <h2>Create a Meeting</h2>

        <form onSubmit={handleCreateMeeting}>
          <div>
            <label htmlFor="meetingTitle">
              Meeting Title
            </label>

            <input
              id="meetingTitle"
              type="text"
              placeholder="Enter meeting title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="scheduledAt">
              Schedule (optional)
            </label>

            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) =>
                setScheduledAt(event.target.value)
              }
            />
          </div>

          <button type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Meeting'}
          </button>
        </form>

        {message && (
          <p className={isSuccess ? 'dashboard-success' : 'dashboard-error'}>
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>Join Existing Meeting</h2>

        <form onSubmit={handleJoinMeeting}>
          <div>
            <label htmlFor="joinMeetingCode">
              Meeting Code
            </label>

            <input
              id="joinMeetingCode"
              type="text"
              placeholder="Paste meeting code here"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              autoComplete="off"
            />
          </div>

          <button type="submit">
            Join Meeting
          </button>
        </form>
      </section>

      <section>
        <h2>My Meetings</h2>

        {meetings.length === 0 ? (
          <p>No meetings created yet.</p>
        ) : (
          meetings.map((meeting) => (
            <article key={meeting.id || meeting.meetingCode}>
              <h3>{meeting.title}</h3>

              <p>
                <strong>Meeting Code:</strong>{' '}
                {meeting.meetingCode}
              </p>

              <p>
                <strong>Status:</strong> {meeting.status}
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(`/meeting/${meeting.meetingCode}`)
                }
              >
                Join Meeting
              </button>
            </article>
          ))
        )}
      </section>

      <button
        className="dashboard-logout"
        type="button"
        onClick={handleLogout}
      >
        Log Out
      </button>
    </main>
  )
}

export default Dashboard
