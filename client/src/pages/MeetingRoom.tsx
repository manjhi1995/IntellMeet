import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import '../App.css'
import './MeetingRoom.css'

type ChatMessage = {
  senderId: string
  message: string
  timestamp: string
}

type ActionItem = {
  _id: string
  title: string
  assignedTo: string
  dueDate: string | null
  completed: boolean
  createdBy: string
}

type Meeting = {
  id?: string
  _id?: string
  meetingCode: string
  title?: string
  status?: string
}

type ApiResponse = {
  message?: string
  user?: {
    id?: string
    _id?: string
    name?: string
    email?: string
  }
  meetings?: Meeting[]
  meeting?: Meeting
  notes?: string
  actionItem?: ActionItem
  actionItems?: ActionItem[]
}

const API_URL = 'https://intellmeet-backend-8b2l.onrender.com'

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

const getLocalDateString = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10)
}

const isPastOrInvalidDate = (value: string) => {
  if (!value) return false

  const selectedDate = new Date(`${value}T00:00:00`)
  const today = new Date(`${getLocalDateString()}T00:00:00`)

  return (
    Number.isNaN(selectedDate.getTime()) ||
    selectedDate < today
  )
}

const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatActionDate = (date: string | null) => {
  if (!date) return 'No due date'

  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable'

  return parsedDate.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function MeetingRoom() {
  const { meetingCode: routeMeetingCode } = useParams()
  const navigate = useNavigate()
  const meetingCode = routeMeetingCode || ''

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const currentUserIdRef = useRef('')
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  const [meetingTitle, setMeetingTitle] = useState('Meeting Room')
  const [status, setStatus] = useState('Connecting...')
  const [mediaError, setMediaError] = useState('')
  const [roomFull, setRoomFull] = useState(false)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(true)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState('')

  const [isHost, setIsHost] = useState(false)
  const [isCheckingHost, setIsCheckingHost] = useState(true)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const [endMeetingError, setEndMeetingError] = useState('')

  const [notes, setNotes] = useState('')
  const [isLoadingCollaboration, setIsLoadingCollaboration] =
    useState(true)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [notesMessage, setNotesMessage] = useState('')
  const [notesError, setNotesError] = useState('')

  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [actionTitle, setActionTitle] = useState('')
  const [actionAssignee, setActionAssignee] = useState('')
  const [actionDueDate, setActionDueDate] = useState('')
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [deletingActionItemId, setDeletingActionItemId] =
    useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const getToken = useCallback(() => {
    return localStorage.getItem('token')
  }, [])

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }, [navigate])

  // Load meeting collaboration data.
  useEffect(() => {
    let isMounted = true

    const loadCollaboration = async () => {
      const token = getToken()

      if (!token) {
        handleAuthFailure()
        return
      }

      if (!meetingCode) {
        navigate('/dashboard', { replace: true })
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/meetings/${encodeURIComponent(
            meetingCode
          )}/collaboration`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const data = await readResponse(response)

        if (!isMounted) return

        if (response.status === 401 || response.status === 403) {
          handleAuthFailure()
          return
        }

        if (!response.ok) {
          setNotesError(
            getErrorMessage(
              data,
              'Unable to load meeting collaboration data.'
            )
          )
          return
        }

        setNotes(typeof data.notes === 'string' ? data.notes : '')
        setActionItems(
          Array.isArray(data.actionItems) ? data.actionItems : []
        )
      } catch (error) {
        console.error('Collaboration request failed:', error)

        if (isMounted) {
          setNotesError('Unable to connect to the server.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingCollaboration(false)
        }
      }
    }

    loadCollaboration()

    return () => {
      isMounted = false
    }
  }, [
    meetingCode,
    getToken,
    handleAuthFailure,
    navigate,
  ])

  // Determine whether the signed-in user owns this meeting.
  useEffect(() => {
    let isMounted = true

    const checkHost = async () => {
      const token = getToken()

      if (!token) {
        handleAuthFailure()
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/meetings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await readResponse(response)

        if (!isMounted) return

        if (response.status === 401 || response.status === 403) {
          handleAuthFailure()
          return
        }

        if (!response.ok) {
          setIsHost(false)
          return
        }

        const meetings = Array.isArray(data.meetings)
          ? data.meetings
          : []

        const meeting = meetings.find(
          (item) => item.meetingCode === meetingCode
        )

        setIsHost(Boolean(meeting))
        if (meeting?.title) setMeetingTitle(meeting.title)
      } catch (error) {
        console.error('Host verification failed:', error)

        if (isMounted) setIsHost(false)
      } finally {
        if (isMounted) setIsCheckingHost(false)
      }
    }

    checkHost()

    return () => {
      isMounted = false
    }
  }, [meetingCode, getToken, handleAuthFailure])

  // Start camera, microphone, WebRTC, and Socket.IO signaling.
  useEffect(() => {
    let isMounted = true
    let socket: Socket | null = null
    let peerConnection: RTCPeerConnection | null = null
    let localStream: MediaStream | null = null
    let remoteStream: MediaStream | null = null

    const flushPendingCandidates = async (
      connection: RTCPeerConnection
    ) => {
      const candidates = [...pendingCandidatesRef.current]
      pendingCandidatesRef.current = []

      for (const candidate of candidates) {
        try {
          await connection.addIceCandidate(
            new RTCIceCandidate(candidate)
          )
        } catch (error) {
          console.error('Unable to add queued ICE candidate:', error)
        }
      }
    }

    const startMeeting = async () => {
      if (!meetingCode) {
        navigate('/dashboard', { replace: true })
        return
      }

      const token = getToken()

      if (!token) {
        handleAuthFailure()
        return
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setMediaError(
          'Camera and microphone access is not supported by this browser. Open the app in a supported browser using localhost or HTTPS.'
        )
        setStatus('Media unavailable')
        return
      }

      try {
        setStatus('Requesting camera and microphone...')

        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })

        if (!isMounted) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }

        localStreamRef.current = localStream
        setIsMicOn(localStream.getAudioTracks().some((track) => track.enabled))
        setIsCameraOn(
          localStream.getVideoTracks().some((track) => track.enabled)
        )

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
          void localVideoRef.current.play().catch(() => undefined)
        }

        remoteStream = new MediaStream()
        remoteStreamRef.current = remoteStream

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream
        }

        peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        })

        peerConnectionRef.current = peerConnection

        localStream.getTracks().forEach((track) => {
          peerConnection?.addTrack(track, localStream!)
        })

        peerConnection.onicecandidate = (event) => {
          if (event.candidate && socket?.connected) {
            socket.emit('ice-candidate', {
              meetingCode,
              candidate: event.candidate,
            })
          }
        }

        peerConnection.ontrack = (event) => {
          if (!remoteStream) return

          const incomingStream = event.streams[0]

          if (incomingStream) {
            incomingStream.getTracks().forEach((track) => {
              const alreadyAdded = remoteStream
                ?.getTracks()
                .some((existingTrack) => existingTrack.id === track.id)

              if (!alreadyAdded) {
                remoteStream?.addTrack(track)
              }
            })
          } else {
            const alreadyAdded = remoteStream
              .getTracks()
              .some((track) => track.id === event.track.id)

            if (!alreadyAdded) remoteStream.addTrack(event.track)
          }

          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream
            void remoteVideoRef.current.play().catch(() => undefined)
          }

          setHasRemoteVideo(true)
          setStatus('Connected')
        }

        peerConnection.onconnectionstatechange = () => {
          if (!peerConnection || !isMounted) return

          switch (peerConnection.connectionState) {
            case 'connected':
              setStatus('Connected')
              break
            case 'connecting':
              setStatus('Connecting...')
              break
            case 'disconnected':
              setStatus('Connection interrupted')
              break
            case 'failed':
              setStatus('Connection failed')
              break
            case 'closed':
              setStatus('Disconnected')
              break
          }
        }

        socket = io(API_URL, {
          auth: { token },
        })

        socketRef.current = socket

        socket.on('connect', () => {
          if (!isMounted) return

          setStatus('Joining meeting...')
          socket?.emit('join-room', meetingCode)
        })

        socket.on('connect_error', (error) => {
          console.error('Socket connection failed:', error)

          if (isMounted) {
            setStatus('Signaling connection failed')
            setMediaError(
              'Unable to connect to the meeting server. Check that the backend is running and your session is valid.'
            )
          }
        })

        socket.on('joined-room', () => {
          if (isMounted) setStatus('Waiting for participant')
        })

        socket.on('room-full', () => {
          if (!isMounted) return

          setRoomFull(true)
          setStatus('Meeting full')
          setMediaError(
            'This meeting already has the maximum number of participants.'
          )
        })

        socket.on('peer-joined', async () => {
          if (!peerConnection || !socket || !isMounted) return

          try {
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)

            socket.emit('offer', {
              meetingCode,
              offer,
            })

            setStatus('Calling participant...')
          } catch (error) {
            console.error('Unable to create WebRTC offer:', error)
            setMediaError('Unable to start the video connection.')
          }
        })

        socket.on(
          'offer',
          async (offer: RTCSessionDescriptionInit) => {
            if (!peerConnection || !socket || !isMounted) return

            try {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
              )

              await flushPendingCandidates(peerConnection)

              const answer = await peerConnection.createAnswer()
              await peerConnection.setLocalDescription(answer)

              socket.emit('answer', {
                meetingCode,
                answer,
              })

              setStatus('Connecting...')
            } catch (error) {
              console.error('Unable to handle WebRTC offer:', error)
              setMediaError('Unable to establish the video connection.')
            }
          }
        )

        socket.on(
          'answer',
          async (answer: RTCSessionDescriptionInit) => {
            if (!peerConnection || !isMounted) return

            try {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
              )

              await flushPendingCandidates(peerConnection)
            } catch (error) {
              console.error('Unable to handle WebRTC answer:', error)
            }
          }
        )

        socket.on(
          'ice-candidate',
          async (candidate: RTCIceCandidateInit) => {
            if (!peerConnection || !isMounted) return

            if (peerConnection.remoteDescription) {
              try {
                await peerConnection.addIceCandidate(
                  new RTCIceCandidate(candidate)
                )
              } catch (error) {
                console.error('Unable to add ICE candidate:', error)
              }
            } else {
              pendingCandidatesRef.current.push(candidate)
            }
          }
        )

        socket.on('chat-history', (messages: ChatMessage[]) => {
          if (!isMounted || !Array.isArray(messages)) return

          setChatMessages(
            messages.filter(
              (item) =>
                item &&
                typeof item.senderId === 'string' &&
                typeof item.message === 'string'
            )
          )
        })

        socket.on('chat-message', (message: ChatMessage) => {
          if (
            !isMounted ||
            !message ||
            typeof message.message !== 'string'
          ) {
            return
          }

          setChatMessages((previous) => {
            const duplicate = previous.some(
              (item) =>
                item.senderId === message.senderId &&
                item.timestamp === message.timestamp &&
                item.message === message.message
            )

            return duplicate ? previous : [...previous, message]
          })
        })

        socket.on('chat-error', (message: string | { message?: string }) => {
          if (!isMounted) return

          setChatError(
            typeof message === 'string'
              ? message
              : message?.message || 'Unable to send the message.'
          )
        })

        socket.on('peer-left', () => {
          if (!isMounted) return

          setHasRemoteVideo(false)
          setStatus('Waiting for participant')

          remoteStream?.getTracks().forEach((track) => track.stop())
          remoteStream = new MediaStream()
          remoteStreamRef.current = remoteStream

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream
          }

          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
          }
        })

        socket.on('meeting-ended', () => {
          if (!isMounted) return

          setStatus('Meeting ended')
          setChatMessages([])

          localStream?.getTracks().forEach((track) => track.stop())
          remoteStream?.getTracks().forEach((track) => track.stop())
          peerConnection?.close()
          socket?.disconnect()

          navigate('/dashboard', { replace: true })
        })

        setStatus('Connecting to meeting...')
      } catch (error) {
        console.error('Unable to start meeting:', error)

        if (!isMounted) return

        const mediaErrorValue = error as DOMException

        if (
          mediaErrorValue.name === 'NotAllowedError' ||
          mediaErrorValue.name === 'SecurityError'
        ) {
          setMediaError(
            'Camera or microphone permission was denied. Allow access in your browser settings and reload the meeting.'
          )
        } else if (mediaErrorValue.name === 'NotFoundError') {
          setMediaError(
            'No camera or microphone was found. Connect a device and try again.'
          )
        } else if (mediaErrorValue.name === 'NotReadableError') {
          setMediaError(
            'Your camera or microphone may already be in use by another application.'
          )
        } else if (mediaErrorValue.name === 'OverconstrainedError') {
          setMediaError(
            'Your camera or microphone does not support the requested settings.'
          )
        } else {
          setMediaError(
            'Unable to start your camera and microphone. Check your device permissions and try again.'
          )
        }

        setStatus('Media unavailable')
      }
    }

    void startMeeting()

    return () => {
      isMounted = false

      if (socket) {
        socket.emit('leave-room', meetingCode)
        socket.disconnect()
      }

      if (peerConnection) peerConnection.close()

      localStream?.getTracks().forEach((track) => track.stop())
      remoteStream?.getTracks().forEach((track) => track.stop())

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }

      if (socketRef.current === socket) socketRef.current = null
      if (peerConnectionRef.current === peerConnection) {
        peerConnectionRef.current = null
      }

      if (localStreamRef.current === localStream) {
        localStreamRef.current = null
      }

      if (remoteStreamRef.current === remoteStream) {
        remoteStreamRef.current = null
      }

      pendingCandidatesRef.current = []
    }
  }, [meetingCode, navigate, getToken, handleAuthFailure])

  // Keep the latest chat message visible.
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [chatMessages])

  const handleToggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || []

    if (!tracks.length) {
      setMediaError('No microphone is available for this meeting.')
      return
    }

    const nextValue = !tracks.some((track) => track.enabled)
    tracks.forEach((track) => {
      track.enabled = nextValue
    })

    setIsMicOn(nextValue)
  }

  const handleToggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || []

    if (!tracks.length) {
      setMediaError('No camera is available for this meeting.')
      return
    }

    const nextValue = !tracks.some((track) => track.enabled)
    tracks.forEach((track) => {
      track.enabled = nextValue
    })

    setIsCameraOn(nextValue)
  }

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const message = chatInput.trim()

    if (!message) return

    if (message.length > 1000) {
      setChatError('Messages cannot exceed 1000 characters.')
      return
    }

    const socket = socketRef.current

    if (!socket?.connected) {
      setChatError('Not connected to the meeting. Please try again.')
      return
    }

    setChatError('')
    socket.emit('chat-message', {
      meetingCode,
      message,
    })
    setChatInput('')
  }

  const handleSaveNotes = async () => {
    if (isSavingNotes) return

    const token = getToken()

    if (!token) {
      handleAuthFailure()
      return
    }

    setIsSavingNotes(true)
    setNotesMessage('')
    setNotesError('')

    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${encodeURIComponent(
          meetingCode
        )}/notes`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure()
        return
      }

      if (!response.ok) {
        setNotesError(getErrorMessage(data, 'Unable to save notes.'))
        return
      }

      if (typeof data.notes === 'string') setNotes(data.notes)

      setNotesMessage('Notes saved successfully.')
    } catch (error) {
      console.error('Save notes request failed:', error)
      setNotesError('Unable to connect to the server.')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleAddActionItem = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (isAddingAction) return

    const itemTitle = actionTitle.trim()
    const assignee = actionAssignee.trim()

    setActionError('')
    setActionMessage('')

    if (!itemTitle) {
      setActionError('Please enter an action item.')
      return
    }

    if (itemTitle.length > 200) {
      setActionError('Action item cannot exceed 200 characters.')
      return
    }

    if (assignee.length > 100) {
      setActionError('Assignee cannot exceed 100 characters.')
      return
    }

    if (actionDueDate && isPastOrInvalidDate(actionDueDate)) {
      setActionError('Due date must be today or a future date.')
      return
    }

    const token = getToken()

    if (!token) {
      handleAuthFailure()
      return
    }

    setIsAddingAction(true)

    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${encodeURIComponent(
          meetingCode
        )}/action-items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: itemTitle,
            assignedTo: assignee,
            dueDate: actionDueDate || null,
          }),
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure()
        return
      }

      if (!response.ok) {
        setActionError(
          getErrorMessage(data, 'Unable to add the action item.')
        )
        return
      }

      if (!data.actionItem) {
        setActionError(
          'The server did not return the created action item.'
        )
        return
      }

      setActionItems((previous) => [
        data.actionItem!,
        ...previous.filter(
          (item) => item._id !== data.actionItem!._id
        ),
      ])

      setActionTitle('')
      setActionAssignee('')
      setActionDueDate('')
      setActionMessage('Action item added.')
    } catch (error) {
      console.error('Add action item request failed:', error)
      setActionError('Unable to connect to the server.')
    } finally {
      setIsAddingAction(false)
    }
  }

  const handleToggleActionItem = async (item: ActionItem) => {
    const token = getToken()

    if (!token) {
      handleAuthFailure()
      return
    }

    const nextCompleted = !item.completed

    setActionError('')
    setActionMessage('')

    setActionItems((previous) =>
      previous.map((current) =>
        current._id === item._id
          ? { ...current, completed: nextCompleted }
          : current
      )
    )

    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${encodeURIComponent(
          meetingCode
        )}/action-items/${encodeURIComponent(item._id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ completed: nextCompleted }),
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure()
        return
      }

      if (!response.ok) {
        setActionItems((previous) =>
          previous.map((current) =>
            current._id === item._id
              ? { ...current, completed: item.completed }
              : current
          )
        )

        setActionError(
          getErrorMessage(data, 'Unable to update the action item.')
        )
      }
    } catch (error) {
      console.error('Update action item request failed:', error)

      setActionItems((previous) =>
        previous.map((current) =>
          current._id === item._id
            ? { ...current, completed: item.completed }
            : current
        )
      )

      setActionError('Unable to connect to the server.')
    }
  }

  const handleDeleteActionItem = async (item: ActionItem) => {
    if (
      !window.confirm(
        `Delete the action item "${item.title}"? This cannot be undone.`
      )
    ) {
      return
    }

    const token = getToken()

    if (!token) {
      handleAuthFailure()
      return
    }

    setDeletingActionItemId(item._id)
    setActionError('')
    setActionMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${encodeURIComponent(
          meetingCode
        )}/action-items/${encodeURIComponent(item._id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure()
        return
      }

      if (!response.ok) {
        setActionError(
          getErrorMessage(data, 'Unable to delete the action item.')
        )
        return
      }

      setActionItems((previous) =>
        previous.filter((current) => current._id !== item._id)
      )
      setActionMessage('Action item deleted.')
    } catch (error) {
      console.error('Delete action item request failed:', error)
      setActionError('Unable to connect to the server.')
    } finally {
      setDeletingActionItemId('')
    }
  }

  const handleLeaveMeeting = () => {
    socketRef.current?.emit('leave-room', meetingCode)
    navigate('/dashboard', { replace: true })
  }

  const handleEndMeeting = async () => {
    if (isEndingMeeting) return

    const confirmed = window.confirm(
      'End this meeting for everyone? All participants will be disconnected and the meeting chat history will be deleted.'
    )

    if (!confirmed) return

    const token = getToken()

    if (!token) {
      handleAuthFailure()
      return
    }

    setIsEndingMeeting(true)
    setEndMeetingError('')

    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${encodeURIComponent(
          meetingCode
        )}/end`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readResponse(response)

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure()
        return
      }

      if (!response.ok) {
        setEndMeetingError(
          getErrorMessage(data, 'Unable to end the meeting.')
        )
        setIsEndingMeeting(false)
        return
      }

      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      remoteStreamRef.current?.getTracks().forEach((track) => track.stop())
      peerConnectionRef.current?.close()
      socketRef.current?.disconnect()

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }

      navigate('/dashboard', { replace: true })
    } catch (error) {
      console.error('End meeting request failed:', error)
      setEndMeetingError('Unable to connect to the server.')
      setIsEndingMeeting(false)
    }
  }

  if (roomFull) {
    return (
      <main className="meeting-page meeting-state-page">
        <section className="meeting-state-card">
          <div className="meeting-state-icon">!</div>
          <p className="meeting-eyebrow">INTELLMEET WORKSPACE</p>
          <h1>Meeting is full</h1>
          <p>
            This meeting has reached its participant limit. You can return
            to your dashboard and try another meeting.
          </p>
          <button
            className="meeting-primary-button"
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="meeting-page">
      <header className="meeting-topbar">
        <button
          className="meeting-brand"
          type="button"
          onClick={() => navigate('/dashboard')}
          aria-label="Go to IntellMeet dashboard"
        >
          <span className="meeting-brand-icon">I</span>
          <span className="meeting-brand-name">
            Intell<span>Meet</span>
          </span>
        </button>

        <div className="meeting-header-center">
          <span className="meeting-header-title">{meetingTitle}</span>
          <span className="meeting-code">
            CODE <strong>{meetingCode}</strong>
          </span>
        </div>

        <div className="meeting-topbar-right">
          <span className="meeting-workspace-label">
            <span className="meeting-workspace-dot" />
            Workspace
          </span>
          <span className="meeting-live-status">
            <span className="meeting-status-dot" />
            {status}
          </span>
        </div>
      </header>

      <div className="meeting-content">
        <section className="meeting-heading">
          <div>
            <p className="meeting-eyebrow">YOUR WORKSPACE / LIVE CALL</p>
            <h1>{meetingTitle}</h1>
            <p className="meeting-subtitle">
              Stay connected, share ideas, and keep every action on track.
            </p>
          </div>

          <button
            className="meeting-back-button"
            type="button"
            onClick={() => navigate('/dashboard')}
          >
            <span aria-hidden="true">←</span> Dashboard
          </button>
        </section>

        {mediaError && (
          <div className="meeting-alert meeting-alert-error" role="alert">
            <span className="meeting-alert-icon">!</span>
            <p>{mediaError}</p>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setMediaError('')}
            >
              ×
            </button>
          </div>
        )}

        <section className="meeting-workspace">
          <div className="meeting-main-column">
            <section className="meeting-panel meeting-video-panel">
              <div className="meeting-panel-heading">
                <div>
                  <h2>Video conference</h2>
                  <p>Your meeting, all in one place.</p>
                </div>
                <span className="meeting-panel-live">
                  <span />
                  LIVE
                </span>
              </div>

              <div className="meeting-video-grid">
                <article className="meeting-video-card meeting-local-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    aria-label="Your camera"
                  />
                  <div className="meeting-video-overlay">
                    <span className="meeting-video-name">You</span>
                    <span className="meeting-video-indicators">
                      {!isMicOn && <span title="Microphone muted">Muted</span>}
                      {!isCameraOn && (
                        <span title="Camera off">Camera off</span>
                      )}
                    </span>
                  </div>

                  {!isCameraOn && (
                    <div className="meeting-video-placeholder">
                      <div className="meeting-video-avatar">You</div>
                      <span>Your camera is off</span>
                    </div>
                  )}
                </article>

                <article className="meeting-video-card meeting-remote-video">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    aria-label="Other participant"
                  />

                  {!hasRemoteVideo && (
                    <div className="meeting-video-placeholder">
                      <div className="meeting-video-avatar meeting-remote-avatar">
                        <span aria-hidden="true">◉</span>
                      </div>
                      <strong>Waiting for someone to join</strong>
                      <span>Share your meeting code to connect.</span>
                    </div>
                  )}

                  <div className="meeting-video-overlay">
                    <span className="meeting-video-name">
                      {hasRemoteVideo ? 'Participant' : 'Remote participant'}
                    </span>
                  </div>
                </article>
              </div>

              <div className="meeting-control-panel">
                <div className="meeting-control-group">
                  <button
                    className={`meeting-control-button ${
                      !isMicOn ? 'meeting-control-off' : ''
                    }`}
                    type="button"
                    onClick={handleToggleMic}
                    aria-pressed={isMicOn}
                    title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    <span className="meeting-control-icon" aria-hidden="true">
                      {isMicOn ? '♩' : '×'}
                    </span>
                    <span>{isMicOn ? 'Mute' : 'Unmute'}</span>
                  </button>

                  <button
                    className={`meeting-control-button ${
                      !isCameraOn ? 'meeting-control-off' : ''
                    }`}
                    type="button"
                    onClick={handleToggleCamera}
                    aria-pressed={isCameraOn}
                    title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    <span className="meeting-control-icon" aria-hidden="true">
                      {isCameraOn ? '▣' : '×'}
                    </span>
                    <span>{isCameraOn ? 'Camera' : 'Camera off'}</span>
                  </button>
                </div>

                <div className="meeting-control-group meeting-exit-controls">
                  <button
                    className="meeting-leave-button"
                    type="button"
                    onClick={handleLeaveMeeting}
                  >
                    <span aria-hidden="true">↗</span> Leave
                  </button>

                  {!isCheckingHost && isHost && (
                    <button
                      className="meeting-end-button"
                      type="button"
                      onClick={handleEndMeeting}
                      disabled={isEndingMeeting}
                    >
                      {isEndingMeeting
                        ? 'Ending...'
                        : 'End for everyone'}
                    </button>
                  )}
                </div>
              </div>

              {endMeetingError && (
                <div
                  className="meeting-inline-error"
                  role="alert"
                >
                  {endMeetingError}
                </div>
              )}
            </section>

            <section className="meeting-panel meeting-notes-panel">
              <div className="meeting-panel-heading">
                <div className="meeting-panel-heading-icon notes-icon">
                  ✎
                </div>
                <div>
                  <h2>Shared notes</h2>
                  <p>Capture important points from the conversation.</p>
                </div>
              </div>

              <textarea
                className="meeting-notes-textarea"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setNotesMessage('')
                  setNotesError('')
                }}
                placeholder="Write your meeting notes here..."
                rows={5}
                aria-label="Shared meeting notes"
              />

              <div className="meeting-notes-footer">
                <div className="meeting-feedback">
                  {notesError && (
                    <span className="meeting-feedback-error">
                      {notesError}
                    </span>
                  )}
                  {notesMessage && (
                    <span className="meeting-feedback-success">
                      {notesMessage}
                    </span>
                  )}
                  {isLoadingCollaboration && (
                    <span className="meeting-muted-text">
                      Loading collaboration data...
                    </span>
                  )}
                </div>

                <button
                  className="meeting-primary-button"
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes || isLoadingCollaboration}
                >
                  {isSavingNotes ? 'Saving...' : 'Save notes'}
                </button>
              </div>
            </section>

            <section className="meeting-panel meeting-actions-panel">
              <div className="meeting-panel-heading">
                <div className="meeting-panel-heading-icon actions-icon">
                  ✓
                </div>
                <div>
                  <h2>Action items</h2>
                  <p>Turn your discussion into clear next steps.</p>
                </div>
                <span className="meeting-count-badge">
                  {actionItems.filter((item) => !item.completed).length} open
                </span>
              </div>

              <form
                className="meeting-action-form"
                onSubmit={handleAddActionItem}
              >
                <div className="meeting-action-form-main">
                  <label
                    className="meeting-sr-only"
                    htmlFor="actionTitle"
                  >
                    Action item
                  </label>
                  <input
                    id="actionTitle"
                    type="text"
                    value={actionTitle}
                    onChange={(event) =>
                      setActionTitle(event.target.value)
                    }
                    placeholder="What needs to be done?"
                    maxLength={200}
                    required
                  />

                  <label
                    className="meeting-sr-only"
                    htmlFor="actionAssignee"
                  >
                    Assign to
                  </label>
                  <input
                    id="actionAssignee"
                    type="text"
                    value={actionAssignee}
                    onChange={(event) =>
                      setActionAssignee(event.target.value)
                    }
                    placeholder="Assign to (optional)"
                    maxLength={100}
                  />

                  <label
                    className="meeting-sr-only"
                    htmlFor="actionDueDate"
                  >
                    Due date
                  </label>
                  <input
                    id="actionDueDate"
                    type="date"
                    value={actionDueDate}
                    onChange={(event) =>
                      setActionDueDate(event.target.value)
                    }
                    min={getLocalDateString()}
                    aria-label="Action item due date"
                  />
                </div>

                <button
                  className="meeting-primary-button meeting-add-action-button"
                  type="submit"
                  disabled={isAddingAction}
                >
                  {isAddingAction ? 'Adding...' : '+ Add task'}
                </button>
              </form>

              {(actionError || actionMessage) && (
                <p
                  className={`meeting-action-feedback ${
                    actionError
                      ? 'meeting-feedback-error'
                      : 'meeting-feedback-success'
                  }`}
                  role="status"
                >
                  {actionError || actionMessage}
                </p>
              )}

              {actionItems.length === 0 ? (
                <div className="meeting-empty-state">
                  <div className="meeting-empty-icon">✓</div>
                  <strong>No action items yet</strong>
                  <p>Add a task to keep the meeting moving forward.</p>
                </div>
              ) : (
                <div className="meeting-action-list">
                  {actionItems.map((item) => (
                    <article
                      className={`meeting-action-item ${
                        item.completed ? 'is-completed' : ''
                      }`}
                      key={item._id}
                    >
                      <label className="meeting-action-check">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleActionItem(item)}
                          aria-label={`Mark ${item.title} ${
                            item.completed ? 'incomplete' : 'complete'
                          }`}
                        />
                        <span className="meeting-custom-check" />
                      </label>

                      <div className="meeting-action-details">
                        <strong>{item.title}</strong>
                        <div className="meeting-action-meta">
                          {item.assignedTo && (
                            <span>
                              <span aria-hidden="true">↗</span>{' '}
                              {item.assignedTo}
                            </span>
                          )}
                          <span>
                            <span aria-hidden="true">◷</span>{' '}
                            {formatActionDate(item.dueDate)}
                          </span>
                        </div>
                      </div>

                      <button
                        className="meeting-delete-action"
                        type="button"
                        onClick={() => handleDeleteActionItem(item)}
                        disabled={deletingActionItemId === item._id}
                        aria-label={`Delete ${item.title}`}
                        title="Delete action item"
                      >
                        {deletingActionItemId === item._id
                          ? '...'
                          : '×'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="meeting-sidebar">
            <section className="meeting-panel meeting-chat-panel">
              <div className="meeting-chat-heading">
                <div>
                  <div className="meeting-chat-title-row">
                    <h2>Meeting chat</h2>
                    <span className="meeting-chat-online-dot" />
                  </div>
                  <p>Messages shared with participants.</p>
                </div>
                <div className="meeting-chat-heading-icon">✉</div>
              </div>

              <div className="meeting-chat-context">
                <span className="meeting-chat-context-icon">I</span>
                <div>
                  <strong>IntellMeet room</strong>
                  <span>Meeting code: {meetingCode}</span>
                </div>
              </div>

              <div
                className="meeting-chat-messages"
                aria-live="polite"
                aria-label="Meeting chat messages"
              >
                {chatMessages.length === 0 ? (
                  <div className="meeting-chat-empty">
                    <div className="meeting-chat-empty-icon">✉</div>
                    <strong>Start the conversation</strong>
                    <p>
                      Send a message to everyone in this meeting.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => {
                    const isOwnMessage =
                      message.senderId === currentUserIdRef.current

                    return (
                      <article
                        className={`meeting-chat-message ${
                          isOwnMessage ? 'own-message' : ''
                        }`}
                        key={`${message.senderId}-${message.timestamp}-${index}`}
                      >
                        <div className="meeting-chat-message-meta">
                          <span>
                            {isOwnMessage ? 'You' : 'Participant'}
                          </span>
                          <time>
                            {formatMessageTime(message.timestamp)}
                          </time>
                        </div>
                        <div className="meeting-chat-bubble">
                          {message.message}
                        </div>
                      </article>
                    )
                  })
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              {chatError && (
                <div className="meeting-chat-error" role="alert">
                  {chatError}
                  <button
                    type="button"
                    aria-label="Dismiss chat error"
                    onClick={() => setChatError('')}
                  >
                    ×
                  </button>
                </div>
              )}

              <form
                className="meeting-chat-form"
                onSubmit={handleSendMessage}
              >
                <label
                  className="meeting-sr-only"
                  htmlFor="meetingChatInput"
                >
                  Write a message
                </label>
                <textarea
                  id="meetingChatInput"
                  value={chatInput}
                  onChange={(event) => {
                    setChatInput(event.target.value)
                    setChatError('')
                  }}
                  placeholder="Type a message..."
                  maxLength={1000}
                  rows={2}
                />
                <div className="meeting-chat-form-footer">
                  <span>Enter a message to share with the room</span>
                  <button
                    className="meeting-send-button"
                    type="submit"
                    disabled={!chatInput.trim()}
                    aria-label="Send message"
                    title="Send message"
                  >
                    <span aria-hidden="true">➤</span>
                  </button>
                </div>
              </form>
            </section>
          </aside>
        </section>

        <footer className="meeting-footer-note">
          <span>© {new Date().getFullYear()} IntellMeet</span>
          <span>Made for better conversations.</span>
        </footer>
      </div>
    </main>
  )
}

export default MeetingRoom