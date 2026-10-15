
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import '../App.css'

function MeetingRoom() {
  const { meetingCode } = useParams()
  const navigate = useNavigate()

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  const [status, setStatus] = useState('Starting meeting...')
  const [mediaError, setMediaError] = useState('')
  const [roomFull, setRoomFull] = useState(false)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(true)

  useEffect(() => {
    if (!meetingCode) {
      navigate('/dashboard')
      return
    }

    let isMounted = true

    const startMeeting = async () => {
      let localStream: MediaStream | null = null

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Camera access is unavailable in this browser context.'
          )
        }

        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })

        if (!isMounted) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }

        localStreamRef.current = localStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
          void localVideoRef.current.play().catch((error) => {
            console.error('Local video playback failed:', error)
          })
        }
      } catch (error) {
        if (!isMounted) return

        const errorName =
          error instanceof Error ? error.name : 'UnknownError'
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        console.error('Camera/microphone access failed:', error)

        let message = errorMessage

        if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
          message =
            'Permission denied. Allow camera and microphone for localhost.'
        } else if (errorName === 'NotFoundError') {
          message = 'No available camera or microphone was found.'
        } else if (errorName === 'NotReadableError') {
          message =
            'Camera or microphone is busy or cannot be accessed. Close other apps using it.'
        } else if (errorName === 'OverconstrainedError') {
          message = 'The requested camera or microphone settings are unavailable.'
        }

        setMediaError(message)
        setIsCameraOn(false)
        setIsMicOn(false)
        setStatus('Joining meeting without camera/microphone...')
      }

      if (!isMounted) {
        localStream?.getTracks().forEach((track) => track.stop())
        return
      }

      const socket = io('http://localhost:5000')
      socketRef.current = socket

      const createPeerConnection = () => {
        if (peerConnectionRef.current) {
          return peerConnectionRef.current
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            {
              urls: 'stun:stun.l.google.com:19302',
            },
          ],
        })

        const stream = localStreamRef.current
        const audioTrack = stream?.getAudioTracks()[0]
        const videoTrack = stream?.getVideoTracks()[0]

        if (audioTrack && stream) {
          peerConnection.addTrack(audioTrack, stream)
        } else {
          peerConnection.addTransceiver('audio', {
            direction: 'recvonly',
          })
        }

        if (videoTrack && stream) {
          peerConnection.addTrack(videoTrack, stream)
        } else {
          peerConnection.addTransceiver('video', {
            direction: 'recvonly',
          })
        }

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', {
              room: meetingCode,
              candidate: event.candidate,
            })
          }
        }

        peerConnection.ontrack = (event) => {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream()
          }

          const tracks = event.streams[0]?.getTracks() ?? [event.track]

          tracks.forEach((track) => {
            if (
              !remoteStreamRef.current
                ?.getTracks()
                .some((existingTrack) => existingTrack.id === track.id)
            ) {
              remoteStreamRef.current?.addTrack(track)
            }
          })

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current

            void remoteVideoRef.current.play().catch((error) => {
              console.error('Remote video playback failed:', error)
              setStatus('Connected, but browser could not play remote video.')
            })
          }

          if (event.track.kind === 'video') {
            setHasRemoteVideo(true)

            event.track.onended = () => {
              setHasRemoteVideo(false)
            }
          }
        }

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState

          if (state === 'connected') {
            setStatus('Connected to participant')
          } else if (state === 'connecting') {
            setStatus('Connecting to participant...')
          } else if (state === 'disconnected' || state === 'failed') {
            setStatus('Participant connection lost')
          }
        }

        peerConnectionRef.current = peerConnection
        return peerConnection
      }

      const flushPendingCandidates = async (
        peerConnection: RTCPeerConnection
      ) => {
        const candidates = pendingCandidatesRef.current.splice(0)

        for (const candidate of candidates) {
          try {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            )
          } catch (error) {
            console.error('Adding queued ICE candidate failed:', error)
          }
        }
      }

      socket.on('connect', () => {
        socket.emit('join-room', meetingCode)
        setStatus('Joining meeting...')
      })

      socket.on('connect_error', (error) => {
        console.error('Socket connection failed:', error)
        setStatus('Unable to connect to the meeting server.')
      })

      socket.on('room-full', () => {
        setRoomFull(true)
        setStatus('This meeting already has two participants.')
      })

      socket.on('room-joined', ({ isInitiator }) => {
        if (isInitiator) {
          setStatus('Waiting for another participant...')
        } else {
          setStatus('Participant joined. Connecting...')
        }
      })

      socket.on('peer-joined', async () => {
        try {
          const peerConnection = createPeerConnection()
          const offer = await peerConnection.createOffer()

          await peerConnection.setLocalDescription(offer)

          socket.emit('offer', {
            room: meetingCode,
            offer,
          })

          setStatus('Calling participant...')
        } catch (error) {
          console.error('Offer creation failed:', error)
          setStatus('Unable to start call.')
        }
      })

      socket.on('offer', async (offer) => {
        try {
          const peerConnection = createPeerConnection()

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
          )

          await flushPendingCandidates(peerConnection)

          const answer = await peerConnection.createAnswer()
          await peerConnection.setLocalDescription(answer)

          socket.emit('answer', {
            room: meetingCode,
            answer,
          })

          setStatus('Joining participant...')
        } catch (error) {
          console.error('Answer creation failed:', error)
          setStatus('Unable to join participant.')
        }
      })

      socket.on('answer', async (answer) => {
        try {
          const peerConnection = peerConnectionRef.current

          if (!peerConnection) return

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          )

          await flushPendingCandidates(peerConnection)
        } catch (error) {
          console.error('Setting answer failed:', error)
          setStatus('Unable to complete connection.')
        }
      })

      socket.on('ice-candidate', async (candidate) => {
        try {
          const peerConnection = peerConnectionRef.current

          if (!peerConnection || !peerConnection.remoteDescription) {
            pendingCandidatesRef.current.push(candidate)
            return
          }

          await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
          )
        } catch (error) {
          console.error('Adding ICE candidate failed:', error)
        }
      })

      socket.on('peer-left', () => {
        setStatus('Participant left the meeting.')
        setHasRemoteVideo(false)

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }

        remoteStreamRef.current = null
        pendingCandidatesRef.current = []

        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
      })
    }

    void startMeeting()

    return () => {
      isMounted = false

      if (socketRef.current) {
        socketRef.current.emit('leave-room', meetingCode)
        socketRef.current.disconnect()
        socketRef.current = null
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }

      remoteStreamRef.current = null
      pendingCandidatesRef.current = []
    }
  }, [meetingCode, navigate])

  const handleToggleMic = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? []

    if (audioTracks.length === 0) {
      setMediaError('Microphone unavailable. Check browser permission and device.')
      return
    }

    const nextState = !isMicOn

    audioTracks.forEach((track) => {
      track.enabled = nextState
    })

    setIsMicOn(nextState)
  }

  const handleToggleCamera = () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? []

    if (videoTracks.length === 0) {
      setMediaError('Camera unavailable. Check browser permission and device.')
      return
    }

    const nextState = !isCameraOn

    videoTracks.forEach((track) => {
      track.enabled = nextState
    })

    setIsCameraOn(nextState)
  }

  const handleLeaveMeeting = () => {
    if (meetingCode && socketRef.current) {
      socketRef.current.emit('leave-room', meetingCode)
    }

    navigate('/dashboard')
  }

  if (roomFull) {
    return (
      <main className="meeting-page">
        <div className="meeting-topbar">
          <h1 className="meeting-brand">IntellMeet</h1>
          <span className="meeting-live-status">Meeting unavailable</span>
        </div>

        <section className="meeting-message-card">
          <h2>Meeting Full</h2>
          <p>This meeting already has two participants.</p>
          <button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="meeting-page">
      <header className="meeting-topbar">
        <h1 className="meeting-brand">IntellMeet</h1>

        <div className="meeting-header-info">
          <span className="meeting-code">
            Code: {meetingCode}
          </span>
          <span className="meeting-live-status">
            <span className="meeting-status-dot" />
            {status}
          </span>
        </div>
      </header>

      <section className="meeting-content">
        <div className="meeting-heading">
          <div>
            <h2>Your meeting room</h2>
            <p>Connect, collaborate, and communicate.</p>
          </div>
        </div>

        {mediaError && (
          <div className="meeting-message-card">
            <h2>Camera or microphone unavailable</h2>
            <p>{mediaError}</p>
            <p>
              Check browser permissions and make sure no other app is using
              your camera or microphone. You can still try joining the meeting.
            </p>
          </div>
        )}

        <div className="meeting-video-grid">
          <article className="meeting-video-card">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />

            {!isCameraOn && (
              <div className="meeting-video-overlay">
                <span className="meeting-avatar">You</span>
                <p>Your camera is off</p>
              </div>
            )}

            <div className="meeting-video-label">
              <span>You</span>
              <span>{isMicOn ? 'Mic on' : 'Mic muted'}</span>
            </div>
          </article>

          <article className="meeting-video-card">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
            />

            {!hasRemoteVideo && (
              <div className="meeting-video-overlay">
                <span className="meeting-avatar">
                  <span className="meeting-avatar-icon">P</span>
                </span>
                <p>Waiting for participant video...</p>
              </div>
            )}

            <div className="meeting-video-label">
              <span>Participant</span>
              <span>{status}</span>
            </div>
          </article>
        </div>

        <div className="meeting-control-panel">
          <div className="meeting-control-group">
            <button
              className={`meeting-control-button ${!isMicOn ? 'is-off' : ''}`}
              onClick={handleToggleMic}
              type="button"
            >
              <span className="meeting-control-icon">
                {isMicOn ? '🎙️' : '🔇'}
              </span>
              {isMicOn ? 'Mute' : 'Unmute'}
            </button>

            <button
              className={`meeting-control-button ${!isCameraOn ? 'is-off' : ''}`}
              onClick={handleToggleCamera}
              type="button"
            >
              <span className="meeting-control-icon">
                {isCameraOn ? '📹' : '🚫'}
              </span>
              {isCameraOn ? 'Camera off' : 'Camera on'}
            </button>
          </div>

          <button
            className="meeting-leave-button"
            onClick={handleLeaveMeeting}
            type="button"
          >
            Leave meeting
          </button>
        </div>

        <p className="meeting-footer-note">
          For the best experience, allow camera and microphone access.
        </p>
      </section>
    </main>
  )
}

export default MeetingRoom
