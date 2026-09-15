import { useEffect, useRef, useState, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket } from '../services/socket.service'

export type WebRTCConnectionState =
  | 'idle'
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed'

export interface UseWebRTCOptions {
  appointmentId?: string
  callSessionId?: string
  roomId?: string
  token: string
  enabled?: boolean
  iceServers?: RTCIceServer[]
  onCallEnded?: (data: { endedBy: string; reason?: string }) => void
  onCallError?: (error: { code: string; message: string }) => void
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

/**
 * Creates a synthetic virtual stream (canvas video + silent audio) for testing,
 * or when physical camera is locked by another tab or unavailable on the machine.
 */
const createSyntheticMediaStream = (label = 'HealthGate User'): MediaStream => {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, 640, 480)
    ctx.fillStyle = '#0b5a66'
    ctx.beginPath()
    ctx.arc(320, 240, 80, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 52px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label.charAt(0).toUpperCase() || 'U', 320, 240)
  }

  const stream = (canvas as any).captureStream
    ? (canvas as any).captureStream(15)
    : new MediaStream()

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      const audioCtx = new AudioCtx()
      const osc = audioCtx.createOscillator()
      const dst = audioCtx.createMediaStreamDestination()
      const gain = audioCtx.createGain()
      gain.gain.value = 0 // silent
      osc.connect(gain)
      gain.connect(dst)
      osc.start()
      dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    }
  } catch (e) {
    console.warn('[WebRTC] Synthetic audio creation error:', e)
  }

  return stream
}

export const useWebRTC = ({
  appointmentId,
  callSessionId,
  roomId,
  token,
  enabled = true,
  iceServers = DEFAULT_ICE_SERVERS,
  onCallEnded,
  onCallError,
}: UseWebRTCOptions) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>('initializing')
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isRemoteParticipantJoined, setIsRemoteParticipantJoined] = useState(false)
  const [remoteUser, setRemoteUser] = useState<{ userId?: string; role?: string; name?: string } | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([])
  const isMakingOfferRef = useRef<boolean>(false)
  const isSettingRemoteAnswerRef = useRef<boolean>(false)
  const durationTimerRef = useRef<any>(null)

  // 1. Acquire Local Camera and Microphone with graceful fallbacks
  const acquireMedia = useCallback(async (): Promise<MediaStream | null> => {
    setMediaError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[WebRTC] getUserMedia unsupported, using synthetic stream fallback.')
        const fallback = createSyntheticMediaStream('HealthGate User')
        localStreamRef.current = fallback
        setLocalStream(fallback)
        return fallback
      }

      let stream: MediaStream | null = null

      // Attempt 1: Full HD / High quality constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
      } catch (err1: any) {
        console.warn('[WebRTC] HD getUserMedia failed, attempting basic constraints:', err1?.name)
        // Attempt 2: Basic video + audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
        } catch (err2: any) {
          console.warn('[WebRTC] Basic video failed, checking if audio is accessible:', err2?.name)
          // Attempt 3: Audio only + synthetic video track (e.g. camera is locked by another tab)
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true })
            const synthetic = createSyntheticMediaStream('User')
            audioOnly.getAudioTracks().forEach((t) => synthetic.addTrack(t))
            stream = synthetic
          } catch (err3: any) {
            console.warn('[WebRTC] Audio also unavailable, creating synthetic test stream:', err3?.name)
            if (err3?.name === 'NotAllowedError' || err3?.name === 'PermissionDeniedError') {
              setMediaError('Camera and microphone permission was denied. Please allow access in browser settings.')
              return null
            }
            stream = createSyntheticMediaStream('User')
          }
        }
      }

      if (stream) {
        localStreamRef.current = stream
        setLocalStream(stream)
        return stream
      }
      return null
    } catch (err: any) {
      console.error('[WebRTC] Error acquiring media devices:', err)
      let message = 'Camera and microphone access is required for your video consultation.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera and microphone permission was denied. Please allow access in browser settings.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone device found. Please connect your media device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera or microphone is currently in use by another application or tab.'
      }
      setMediaError(message)
      return null
    }
  }, [])

  // 2. Initialize RTCPeerConnection
  const createPeerConnection = useCallback((stream: MediaStream): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    const effectiveIceServers =
      iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS

    console.log('[WebRTC] Creating RTCPeerConnection with ICE servers:', effectiveIceServers)
    const pc = new RTCPeerConnection({
      iceServers: effectiveIceServers,
    })

    // Attach local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind)
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      } else {
        setRemoteStream((prev) => {
          if (prev) {
            prev.addTrack(event.track)
            return prev
          }
          return new MediaStream([event.track])
        })
      }
    }

    // Handle local ICE candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          appointmentId: appointmentId || undefined,
          callSessionId: callSessionId || undefined,
          roomId: roomId || undefined,
          candidate: event.candidate,
        })
      }
    }

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[WebRTC] Connection state changed:', state)
      switch (state) {
        case 'connected':
          setConnectionState('connected')
          break
        case 'connecting':
          setConnectionState('connecting')
          break
        case 'disconnected':
          setConnectionState('reconnecting')
          break
        case 'failed':
          setConnectionState('failed')
          break
        case 'closed':
          setConnectionState('closed')
          break
        default:
          break
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce?.()
      }
    }

    peerConnectionRef.current = pc
    return pc
  }, [appointmentId, callSessionId, roomId, iceServers])

  // Helper to drain queued ICE candidates once remote description is set
  const drainCandidateQueue = async (pc: RTCPeerConnection) => {
    while (candidateQueueRef.current.length > 0) {
      const cand = candidateQueueRef.current.shift()
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch (e) {
          console.warn('[WebRTC] Error adding buffered ICE candidate:', e)
        }
      }
    }
  }

  // 3. Initiate Offer (Safe negotiation - called ONLY by the designated initiator)
  const initiateOffer = useCallback(async () => {
    const pc = peerConnectionRef.current
    const socket = socketRef.current
    if (!pc || !socket) return

    try {
      isMakingOfferRef.current = true
      console.log('[WebRTC] Initiator creating and sending SDP offer...')
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      if (pc.signalingState !== 'stable') {
        console.warn('[WebRTC] Signaling state not stable during offer creation, skipping.')
        return
      }

      await pc.setLocalDescription(offer)
      socket.emit('offer', {
        appointmentId: appointmentId || undefined,
        callSessionId: callSessionId || undefined,
        roomId: roomId || undefined,
        sdp: pc.localDescription,
      })
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err)
    } finally {
      isMakingOfferRef.current = false
    }
  }, [appointmentId, callSessionId, roomId])

  // 4. Main Lifecycle Effect
  useEffect(() => {
    let isMounted = true

    const targetIdentifier = callSessionId || appointmentId
    if (!enabled || !targetIdentifier || !token) {
      return
    }

    const setupSession = async () => {
      const stream = await acquireMedia()
      if (!stream || !isMounted) return

      createPeerConnection(stream)
      const socket = getSocket(token)
      socketRef.current = socket

      // Room Joined Event
      socket.on('room-joined', (data) => {
        console.log('[WebRTC] room-joined event:', data)
        if (!isMounted) return

        if (data.participantCount > 1) {
          // As the second person to join, initiate the SDP offer
          setIsRemoteParticipantJoined(true)
          setConnectionState('connecting')
          setTimeout(() => {
            initiateOffer()
          }, 350)
        } else {
          // First person in the room: wait for the second participant
          setConnectionState('waiting')
        }
      })

      // Another participant entered the room
      socket.on('participant-joined', (participant) => {
        console.log('[WebRTC] Remote participant joined:', participant)
        if (!isMounted) return
        setIsRemoteParticipantJoined(true)
        setRemoteUser(participant)
        setConnectionState('connecting')
        // NOTE: We do NOT call initiateOffer here; the newly joined participant will send the Offer!
      })

      // Received SDP Offer from peer
      socket.on('offer', async (data: { sdp: RTCSessionDescriptionInit; senderId: string }) => {
        console.log('[WebRTC] Received offer from peer')
        if (!isMounted) return
        const currentPc = peerConnectionRef.current
        if (!currentPc) return

        try {
          if (isMakingOfferRef.current && currentPc.signalingState !== 'stable') {
            console.warn('[WebRTC] Collision detected, rolling back local offer')
            await currentPc.setLocalDescription({ type: 'rollback' })
          }

          await currentPc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          await drainCandidateQueue(currentPc)

          const answer = await currentPc.createAnswer()
          await currentPc.setLocalDescription(answer)

          socket.emit('answer', {
            appointmentId: appointmentId || undefined,
            callSessionId: callSessionId || undefined,
            roomId: roomId || undefined,
            sdp: currentPc.localDescription,
          })
        } catch (err) {
          console.error('[WebRTC] Error handling offer:', err)
        }
      })

      // Received SDP Answer from peer
      socket.on('answer', async (data: { sdp: RTCSessionDescriptionInit }) => {
        console.log('[WebRTC] Received answer from peer')
        if (!isMounted) return
        const currentPc = peerConnectionRef.current
        if (!currentPc) return

        try {
          isSettingRemoteAnswerRef.current = true
          await currentPc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          await drainCandidateQueue(currentPc)
        } catch (err) {
          console.error('[WebRTC] Error setting remote description from answer:', err)
        } finally {
          isSettingRemoteAnswerRef.current = false
        }
      })

      // Received ICE candidate from peer
      socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        const currentPc = peerConnectionRef.current
        if (!currentPc || !data.candidate) return

        if (currentPc.remoteDescription && currentPc.remoteDescription.type) {
          try {
            await currentPc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } catch (e) {
            console.warn('[WebRTC] Error adding received ICE candidate:', e)
          }
        } else {
          candidateQueueRef.current.push(data.candidate)
        }
      })

      socket.on('participant-left', (data) => {
        console.log('[WebRTC] Remote participant left:', data)
        if (!isMounted) return
        setIsRemoteParticipantJoined(false)
        setRemoteStream(null)
        setConnectionState('waiting')
      })

      socket.on('call-ended', (data) => {
        console.log('[WebRTC] Call ended notification:', data)
        if (!isMounted) return
        setConnectionState('closed')
        if (onCallEnded) onCallEnded(data)
      })

      socket.on('call-error', (err) => {
        console.error('[WebRTC] Call error received:', err)
        if (!isMounted) return
        // Only set failed state on non-ignorable errors
        if (err.code === 'UNAUTHORIZED' || err.code === 'NOT_FOUND' || err.code === 'MEETING_NOT_STARTED') {
          setConnectionState('failed')
        }
        if (onCallError) onCallError(err)
      })

      // Emit join-call with both appointmentId and callSessionId
      console.log('[WebRTC] Emitting join-call with identifier:', { appointmentId, callSessionId, roomId })
      socket.emit('join-call', {
        appointmentId: appointmentId || undefined,
        callSessionId: callSessionId || undefined,
        roomId: roomId || undefined,
      })
    }

    setupSession()

    // Cleanup on unmount
    return () => {
      isMounted = false

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }

      if (socketRef.current) {
        socketRef.current.emit('leave-call', {
          appointmentId: appointmentId || undefined,
          callSessionId: callSessionId || undefined,
          roomId: roomId || undefined,
        })
        socketRef.current.off('room-joined')
        socketRef.current.off('participant-joined')
        socketRef.current.off('offer')
        socketRef.current.off('answer')
        socketRef.current.off('ice-candidate')
        socketRef.current.off('participant-left')
        socketRef.current.off('call-ended')
        socketRef.current.off('call-error')
      }
    }
  }, [
    appointmentId,
    callSessionId,
    roomId,
    token,
    acquireMedia,
    createPeerConnection,
    initiateOffer,
    onCallEnded,
    onCallError,
  ])

  // Call duration counter when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }
    }
  }, [connectionState])

  // Call Controls
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsAudioMuted((prev) => !prev)
    }
  }, [])

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoMuted((prev) => !prev)
    }
  }, [])

  const endCall = useCallback((reason = 'Consultation completed') => {
    if (socketRef.current) {
      socketRef.current.emit('end-call', {
        appointmentId: appointmentId || undefined,
        callSessionId: callSessionId || undefined,
        roomId: roomId || undefined,
        reason,
      })
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      setLocalStream(null)
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setConnectionState('closed')
  }, [appointmentId, callSessionId, roomId])

  return {
    localStream,
    remoteStream,
    connectionState,
    isAudioMuted,
    isVideoMuted,
    isRemoteParticipantJoined,
    remoteUser,
    mediaError,
    callDuration,
    toggleAudio,
    toggleVideo,
    endCall,
    retryMedia: acquireMedia,
  }
}
