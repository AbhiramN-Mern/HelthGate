import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getVideoCallDetailsApi,
  endVideoCallApi,
  type VideoCallSessionDetails,
} from '../../api/auth.api'
import { useWebRTC } from '../../hooks/useWebRTC'
import { RemoteVideo } from '../../components/video/RemoteVideo'
import { LocalVideo } from '../../components/video/LocalVideo'
import { CallControls } from '../../components/video/CallControls'
import './ConsultationPage.css'

export default function ConsultationPage() {
  const { callSessionId, appointmentId: paramApptId } = useParams<{
    callSessionId?: string
    appointmentId?: string
  }>()
  const navigate = useNavigate()

  const activeId = callSessionId || paramApptId || ''

  const [session, setSession] = useState<VideoCallSessionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [callEndedInfo, setCallEndedInfo] = useState<{ endedBy: string; reason?: string } | null>(null)

  const token = localStorage.getItem('helthgate_token') || ''

  const getDashboardRoute = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('helthgate_user') || '{}')
    if (user.role === 'doctor' || session?.userRole === 'doctor') {
      return '/doctor/dashboard'
    }
    return '/patient/home'
  }, [session?.userRole])

  // Fetch session authorization and metadata from backend
  const fetchSession = useCallback(async () => {
    if (!activeId) {
      setSessionError('Invalid consultation link: Session or Appointment ID missing.')
      setLoading(false)
      return
    }

    if (!token) {
      setSessionError('You must be logged in to access this video consultation.')
      setLoading(false)
      return
    }

    setLoading(true)
    setSessionError(null)

    try {
      const data = await getVideoCallDetailsApi(activeId, token)
      if (data && data.success) {
        setSession(data)
      } else {
        setSessionError(data.message || 'Unable to authorize video consultation session.')
      }
    } catch (err: any) {
      console.error('[ConsultationPage] Failed to fetch session:', err)
      setSessionError(err.message || 'Failed to initialize consultation room. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [activeId, token])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Call End Handler
  const handleCallEndedEvent = useCallback(
    async (data: { endedBy: string; reason?: string }) => {
      console.log('[ConsultationPage] Call ended notification received:', data)
      setCallEndedInfo(data)
      try {
        if (activeId && token) {
          await endVideoCallApi(activeId, token)
        }
      } catch (e) {
        console.warn('Error recording call termination:', e)
      }
    },
    [activeId, token],
  )

  const handleCallErrorEvent = useCallback((err: { code: string; message: string }) => {
    console.error('[ConsultationPage] Call error event:', err)
    if (err.code === 'UNAUTHORIZED' || err.code === 'NOT_FOUND') {
      setSessionError(err.message || 'Access to this consultation room was denied.')
    }
  }, [])

  // Initialize WebRTC hook
  const {
    localStream,
    remoteStream,
    connectionState,
    isAudioMuted,
    isVideoMuted,
    mediaError,
    callDuration,
    toggleAudio,
    toggleVideo,
    endCall,
    retryMedia,
  } = useWebRTC({
    appointmentId: session?.appointmentId || paramApptId || '',
    callSessionId: session?.callSession?.id || callSessionId || activeId,
    roomId: session?.roomId,
    token,
    iceServers: session?.iceServers,
    onCallEnded: handleCallEndedEvent,
    onCallError: handleCallErrorEvent,
  })

  // Local user explicitly ends the call
  const handleUserEndCall = async () => {
    if (window.confirm('Are you sure you want to end this video consultation?')) {
      endCall('Consultation concluded by user')
      try {
        if (activeId && token) {
          await endVideoCallApi(activeId, token)
        }
      } catch (e) {
        console.warn('Error finalizing end call:', e)
      }
      navigate(getDashboardRoute())
    }
  }

  // Render: Loading screen
  if (loading) {
    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div className="hg-error-card">
            <div className="hg-waiting-pulse-wrap" style={{ margin: '0 auto 16px auto' }}>
              <div className="hg-pulse-ring"></div>
              <div className="hg-waiting-avatar">HG</div>
            </div>
            <h3 className="hg-error-title">Authorizing Consultation Room...</h3>
            <p className="hg-error-message">
              Verifying your appointment credentials and medical records securely.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render: Session Authorization Error (e.g. cancelled, unauthorized, pending payment)
  if (sessionError) {
    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div className="hg-error-card">
            <div className="hg-error-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="hg-error-title">Consultation Unavailable</h3>
            <p className="hg-error-message">{sessionError}</p>
            <div className="hg-error-actions">
              <button
                type="button"
                className="hg-btn-secondary-action"
                onClick={fetchSession}
              >
                Try Again
              </button>
              <button
                type="button"
                className="hg-btn-primary-action"
                onClick={() => navigate(getDashboardRoute())}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render: Camera / Microphone Permission Denied Screen
  if (mediaError) {
    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div className="hg-error-card">
            <div className="hg-error-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" strokeWidth="2.5" />
              </svg>
            </div>
            <h3 className="hg-error-title">Media Permission Required</h3>
            <p className="hg-error-message">{mediaError}</p>
            <div className="hg-error-actions">
              <button
                type="button"
                className="hg-btn-primary-action"
                onClick={retryMedia}
              >
                Try Again
              </button>
              <button
                type="button"
                className="hg-btn-secondary-action"
                onClick={() => navigate(getDashboardRoute())}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render: Call Ended Modal/Screen
  if (callEndedInfo) {
    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div className="hg-error-card">
            <div className="hg-error-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="hg-error-title">Consultation Concluded</h3>
            <p className="hg-error-message">
              The video call has ended. Your appointment record and consultation metadata have been safely updated.
            </p>
            <div className="hg-error-actions">
              <button
                type="button"
                className="hg-btn-primary-action"
                onClick={() => navigate(getDashboardRoute())}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const remoteUserName =
    session?.userRole === 'patient'
      ? session?.doctorName || 'Doctor'
      : session?.patientName || 'Patient'

  const localUserName = session?.userName || 'You'

  return (
    <div className="hg-consultation-page">
      {/* Top Clinical Header */}
      <header className="hg-consultation-header">
        <div className="hg-header-brand-wrap">
          <span className="hg-header-brand-badge">HealthGate</span>
          <div className="hg-header-title-box">
            <span className="hg-header-title">
              {session?.userRole === 'patient'
                ? `Dr. ${session.doctorName.replace(/^Dr\.?\s*/i, '')}`
                : `Patient: ${session?.patientName || 'Patient'}`}
            </span>
            <span className="hg-header-sub">
              {session?.specialization} • {session?.timeSlot || 'Scheduled Slot'}
            </span>
          </div>
        </div>

        <div className="hg-header-right">
          <span className={`hg-status-pill ${connectionState}`}>
            <span className="hg-status-pulse-dot" />
            {connectionState === 'connected' && 'Encrypted • Connected'}
            {connectionState === 'waiting' && 'Waiting for participant'}
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'reconnecting' && 'Reconnecting...'}
            {connectionState === 'failed' && 'Connection Failed'}
            {connectionState === 'closed' && 'Call Closed'}
          </span>

          <button
            type="button"
            className="hg-btn-exit-header"
            onClick={handleUserEndCall}
            title="Leave consultation"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="hg-consultation-stage">
        {/* Remote Video (Main View) */}
        <RemoteVideo
          stream={remoteStream}
          connectionState={connectionState}
          remoteUserName={remoteUserName}
          remoteUserRole={session?.userRole === 'patient' ? 'doctor' : 'patient'}
          specialization={session?.specialization}
        />

        {/* Local Floating Video (Picture-in-Picture Preview) */}
        <LocalVideo
          stream={localStream}
          isAudioMuted={isAudioMuted}
          isVideoMuted={isVideoMuted}
          userName={localUserName}
        />
      </main>

      {/* Bottom Controls Bar */}
      <CallControls
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        callDuration={callDuration}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onEndCall={handleUserEndCall}
      />
    </div>
  )
}
