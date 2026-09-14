import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getVideoCallDetailsApi,
  endVideoCallApi,
  type VideoCallSessionDetails,
  type AppointmentItem,
  type PrescriptionItem,
} from '../../api/auth.api'
import { useWebRTC } from '../../hooks/useWebRTC'
import { RemoteVideo } from '../../components/video/RemoteVideo'
import { LocalVideo } from '../../components/video/LocalVideo'
import { CallControls } from '../../components/video/CallControls'
import { PrescriptionModal } from '../../components/prescription/PrescriptionModal'
import { PatientPrescriptionModal } from '../../components/prescription/PatientPrescriptionModal'
import {
  ConsultationChatDrawer,
  type ChatMessage,
  type ChatAttachment,
} from '../../components/video/ConsultationChatDrawer'
import { getSocket } from '../../services/socket.service'
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
  const [showDoctorPrescriptionModal, setShowDoctorPrescriptionModal] = useState(false)
  const [savedPrescription, setSavedPrescription] = useState<PrescriptionItem | null>(null)
  const [showPatientPrescriptionModal, setShowPatientPrescriptionModal] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)

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
      setCallEndedInfo({ endedBy: 'user', reason: 'Consultation concluded by user' })
    }
  }

  // Real-time consultation chat listener
  useEffect(() => {
    if (!token) return
    const socket = getSocket(token)

    const handleNewChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      setIsChatOpen((open) => {
        if (!open) {
          setUnreadChatCount((count) => count + 1)
        }
        return open
      })
    }

    socket.on('new-chat-message', handleNewChatMessage)

    return () => {
      socket.off('new-chat-message', handleNewChatMessage)
    }
  }, [token])

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((open) => {
      if (!open) {
        setUnreadChatCount(0)
      }
      return !open
    })
  }, [])

  const handleSendMessage = useCallback(
    (text: string, attachment?: ChatAttachment | null) => {
      if (!token) return
      const socket = getSocket(token)
      socket.emit('send-chat-message', {
        roomId: session?.roomId,
        text,
        attachment,
      })
    },
    [token, session?.roomId],
  )

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

  // Render: Call Ended Screen with Post-Consultation Prescription Flow
  if (callEndedInfo) {
    const isDoctor = session?.userRole === 'doctor'
    const modalAppt: AppointmentItem | null = session
      ? {
          _id: session.appointmentId || paramApptId || '',
          appointmentDate: session.appointmentDate || new Date().toISOString(),
          timeSlot: session.timeSlot || '10:00 AM',
          status: 'completed',
          patient: {
            _id: '',
            name: session.patientName || 'Patient',
            email: '',
          },
          doctor: {
            _id: '',
            user: { name: session.doctorName || 'Doctor' },
            specialization: session.specialization,
          },
          consultationType: 'online',
        }
      : null

    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div className="hg-error-card" style={{ maxWidth: '560px', padding: '32px' }}>
            <div
              className="hg-error-icon-box"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h3 className="hg-error-title" style={{ fontSize: '1.4rem', color: '#0f172a', marginBottom: '6px' }}>
              {isDoctor ? 'Consultation Completed' : 'Consultation Concluded'}
            </h3>

            <p className="hg-error-message" style={{ fontSize: '0.92rem', color: '#64748b', marginBottom: '20px' }}>
              {isDoctor
                ? `The video consultation with ${session?.patientName || 'the patient'} has finished successfully. You can now issue clinical advice and a medicine prescription.`
                : `Your video consultation with Dr. ${session?.doctorName?.replace(/^Dr\.?\s*/i, '') || 'Doctor'} has concluded.`}
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isDoctor ? 'Patient' : 'Attending Doctor'}
                  </span>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {isDoctor ? session?.patientName || 'Patient' : `Dr. ${session?.doctorName?.replace(/^Dr\.?\s*/i, '') || 'Doctor'}`}
                  </div>
                  {session?.specialization && (
                    <div style={{ fontSize: '0.78rem', color: '#0ea5a4', fontWeight: 600 }}>
                      {session.specialization}
                    </div>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Appointment Slot
                  </span>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {session?.timeSlot || 'Scheduled Slot'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {session?.appointmentDate
                      ? new Date(session.appointmentDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Today'}
                  </div>
                </div>
              </div>

              {savedPrescription && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    color: '#166534',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>✓</span>
                  <span>Prescription created with {savedPrescription.medicines?.length || 0} prescribed medicine(s).</span>
                </div>
              )}
            </div>

            <div className="hg-error-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {isDoctor ? (
                <>
                  <button
                    type="button"
                    className="hg-btn-primary-action"
                    style={{
                      background: 'linear-gradient(135deg, #0d5c63 0%, #088395 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => setShowDoctorPrescriptionModal(true)}
                  >
                    {savedPrescription ? '📄 Edit Prescription' : '📄 Create Prescription & Advice'}
                  </button>
                  <button
                    type="button"
                    className="hg-btn-secondary-action"
                    onClick={() => navigate(getDashboardRoute())}
                  >
                    {savedPrescription ? 'Return to Dashboard' : 'Skip & Return to Dashboard'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="hg-btn-primary-action"
                    style={{
                      background: 'linear-gradient(135deg, #0d5c63 0%, #088395 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => setShowPatientPrescriptionModal(true)}
                  >
                    📄 View Prescription
                  </button>
                  <button
                    type="button"
                    className="hg-btn-secondary-action"
                    onClick={() => navigate(getDashboardRoute())}
                  >
                    Return to Home
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Prescription Modal */}
        {showDoctorPrescriptionModal && modalAppt && (
          <PrescriptionModal
            isOpen={showDoctorPrescriptionModal}
            appointment={modalAppt}
            token={token}
            onClose={() => setShowDoctorPrescriptionModal(false)}
            onSaved={(prescription) => {
              setSavedPrescription(prescription)
            }}
          />
        )}

        {/* Patient Prescription Viewer Modal */}
        {showPatientPrescriptionModal && (
          <PatientPrescriptionModal
            isOpen={showPatientPrescriptionModal}
            onClose={() => setShowPatientPrescriptionModal(false)}
            appointmentId={session?.appointmentId || paramApptId}
            token={token}
            fallbackPatientName={session?.patientName}
          />
        )}
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
        isChatOpen={isChatOpen}
        unreadChatCount={unreadChatCount}
        onToggleChat={handleToggleChat}
      />

      {/* Real-time Clinical Chat & Attachment Drawer */}
      <ConsultationChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentUserId={session?.userId || JSON.parse(localStorage.getItem('helthgate_user') || '{}')?.id || JSON.parse(localStorage.getItem('helthgate_user') || '{}')?._id}
        currentUserRole={session?.userRole}
        currentUserName={session?.userName}
        otherUserName={remoteUserName}
        otherUserRole={session?.userRole === 'patient' ? 'doctor' : 'patient'}
      />
    </div>
  )
}
