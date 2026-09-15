import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getVideoCallDetailsApi,
  endVideoCallApi,
  getPrescriptionByAppointmentApi,
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
  const [meetingNotStarted, setMeetingNotStarted] = useState(false)
  const [callEndedInfo, setCallEndedInfo] = useState<{ endedBy: string; reason?: string } | null>(null)
  const [showDoctorPrescriptionModal, setShowDoctorPrescriptionModal] = useState(false)
  const [savedPrescription, setSavedPrescription] = useState<PrescriptionItem | null>(null)
  const [showPatientPrescriptionModal, setShowPatientPrescriptionModal] = useState(false)
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false)
  const [isEndingCall, setIsEndingCall] = useState(false)
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
    setMeetingNotStarted(false)

    try {
      const data = await getVideoCallDetailsApi(activeId, token)
      if (data && data.success) {
        if (
          data.callSession?.status === 'CALL_ENDED' ||
          data.callSession?.status === 'ended' ||
          data.meetingStatus === 'CALL_ENDED'
        ) {
          setSession(data)
          setCallEndedInfo({ endedBy: 'system', reason: 'Consultation concluded' })
        } else if (
          data.userRole === 'patient' &&
          data.meetingStatus !== 'DOCTOR_STARTED' &&
          data.meetingStatus !== 'PATIENT_JOINED' &&
          data.callSession?.status !== 'DOCTOR_STARTED' &&
          data.callSession?.status !== 'PATIENT_JOINED'
        ) {
          setMeetingNotStarted(true)
        } else {
          setSession(data)
        }
      } else {
        if (
          data?.code === 'MEETING_NOT_STARTED' ||
          data?.message?.toLowerCase().includes('not started') ||
          data?.message?.toLowerCase().includes('not yet')
        ) {
          setMeetingNotStarted(true)
        } else {
          setSessionError(data.message || 'Unable to authorize video consultation session.')
        }
      }
    } catch (err: any) {
      console.error('[ConsultationPage] Failed to fetch session:', err)
      if (
        err.code === 'MEETING_NOT_STARTED' ||
        err.message?.toLowerCase().includes('not started') ||
        err.message?.toLowerCase().includes('not yet')
      ) {
        setMeetingNotStarted(true)
      } else {
        setSessionError(err.message || 'Failed to initialize consultation room. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [activeId, token])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Real-time synchronization: When the doctor starts the consultation while the patient is waiting, auto-join
  useEffect(() => {
    if (!token || !meetingNotStarted) return
    const socket = getSocket(token)

    const handleDoctorStarted = (data: any) => {
      console.log('[ConsultationPage] Doctor has started the video consultation:', data)
      setMeetingNotStarted(false)
      fetchSession()
    }

    socket.on('video-call-incoming', handleDoctorStarted)
    socket.on('doctor-started', handleDoctorStarted)

    return () => {
      socket.off('video-call-incoming', handleDoctorStarted)
      socket.off('doctor-started', handleDoctorStarted)
    }
  }, [token, meetingNotStarted, fetchSession])


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
    if (err.code === 'MEETING_NOT_STARTED') {
      setMeetingNotStarted(true)
    } else if (err.code === 'UNAUTHORIZED' || err.code === 'NOT_FOUND') {
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
    enabled: !meetingNotStarted && !!session && !!session.roomId,
    iceServers: session?.iceServers,
    onCallEnded: handleCallEndedEvent,
    onCallError: handleCallErrorEvent,
  })

  // Local user requests to end the call (opens custom confirmation modal)
  const handleUserEndCall = () => {
    setShowEndCallConfirm(true)
  }

  // User confirmed ending the call
  const handleConfirmEndCall = async () => {
    setIsEndingCall(true)
    endCall('Consultation concluded by user')
    try {
      if (activeId && token) {
        await endVideoCallApi(activeId, token)
      }
    } catch (e) {
      console.warn('Error finalizing end call:', e)
    } finally {
      setIsEndingCall(false)
      setShowEndCallConfirm(false)
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

  // Auto-fetch prescription status when consultation concludes
  useEffect(() => {
    if (!callEndedInfo || savedPrescription) return
    const apptId = session?.appointmentId || paramApptId
    if (!apptId || !token) return

    let isMounted = true
    getPrescriptionByAppointmentApi(apptId, token)
      .then((res) => {
        if (isMounted && res.prescription) {
          setSavedPrescription(res.prescription)
        }
      })
      .catch(() => {
        // No prescription created yet
      })

    return () => {
      isMounted = false
    }
  }, [callEndedInfo, session?.appointmentId, paramApptId, token, savedPrescription])

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

  // Render: Doctor has not started consultation yet (No waiting room!)
  if (meetingNotStarted) {
    return (
      <div className="hg-consultation-page">
        <div className="hg-error-screen">
          <div
            className="hg-error-card"
            style={{
              maxWidth: '460px',
              padding: '36px 32px',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(14, 165, 164, 0.15)',
            }}
          >
            <div
              className="hg-error-icon-box"
              style={{
                width: '68px',
                height: '68px',
                margin: '0 auto 20px auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(14, 165, 164, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)',
                color: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
              }}
            >
              📹
            </div>
            <h3
              className="hg-error-title"
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '12px',
              }}
            >
              Consultation Not Started
            </h3>
            <p
              className="hg-error-message"
              style={{
                fontSize: '0.94rem',
                color: '#475569',
                lineHeight: 1.6,
                marginBottom: '28px',
              }}
            >
              The doctor has not started the consultation yet. You will be notified when the doctor starts the meeting.
            </p>
            <div className="hg-error-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="hg-btn-primary-action"
                style={{
                  background: 'linear-gradient(135deg, #0ea5a4 0%, #0284c7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 36px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(14, 165, 164, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => navigate('/patient/home')}
              >
                Close
              </button>
            </div>
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

    const formattedDate = session?.appointmentDate
      ? new Date(session.appointmentDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Today'

    const attendingDoctor = `Dr. ${session?.doctorName?.replace(/^Dr\.?\s*/i, '') || 'Doctor'}`
    const patientName = session?.patientName || 'Patient'

    return (
      <div className="hg-consultation-page">
        <div className="hg-completion-screen">
          <div className="hg-completion-card">
            {/* Glowing Success Ring */}
            <div className="hg-completion-icon-ring">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h2 className="hg-completion-title">
              {isDoctor ? 'Consultation Completed' : 'Consultation Concluded'}
            </h2>

            <p className="hg-completion-subtitle">
              {isDoctor
                ? `The video consultation with ${patientName} has finished successfully. You can now issue clinical advice and a medicine prescription.`
                : `Your video consultation with ${attendingDoctor} has concluded. All consultation records and prescriptions are securely saved.`}
            </p>

            {/* Clinical Details Box */}
            <div className="hg-completion-details-box">
              <div className="hg-details-grid">
                <div className="hg-detail-item">
                  <span className="hg-detail-label">
                    {isDoctor ? 'Patient' : 'Attending Doctor'}
                  </span>
                  <div className="hg-detail-val-main">
                    {isDoctor ? patientName : attendingDoctor}
                  </div>
                  {session?.specialization && (
                    <span className="hg-specialization-badge">
                      {session.specialization}
                    </span>
                  )}
                </div>

                <div className="hg-detail-item">
                  <span className="hg-detail-label">Appointment Session</span>
                  <div className="hg-detail-val-main">
                    {session?.timeSlot || 'Scheduled Slot'}
                  </div>
                  <div className="hg-detail-val-sub">
                    <span>📅 {formattedDate}</span>
                    <span>•</span>
                    <span>Online Video</span>
                  </div>
                </div>
              </div>

              {/* Prescription Status Banner */}
              {savedPrescription ? (
                <div className="hg-completion-rx-banner issued">
                  <div className="hg-rx-banner-content">
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                    <div>
                      <span className="hg-rx-banner-title">
                        Medical Prescription Issued
                      </span>
                      <span className="hg-rx-banner-sub">
                        {savedPrescription.medicines?.length || 0} prescribed medicine(s)
                        {savedPrescription.labTests && savedPrescription.labTests.length > 0
                          ? ` • ${savedPrescription.labTests.length} lab investigation(s)`
                          : ''}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Rx
                  </span>
                </div>
              ) : (
                <div className="hg-completion-rx-banner pending">
                  <div className="hg-rx-banner-content">
                    <span style={{ fontSize: '1.2rem' }}>📋</span>
                    <div>
                      <span className="hg-rx-banner-title">
                        {isDoctor ? 'Prescription Pending' : 'Prescription Awaiting'}
                      </span>
                      <span className="hg-rx-banner-sub">
                        {isDoctor
                          ? 'Issue medicines and medical advice to complete this patient visit.'
                          : 'Your doctor will finalize prescription and clinical advice shortly.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="hg-completion-actions">
              {isDoctor ? (
                <>
                  <button
                    type="button"
                    className="hg-btn-completed-primary"
                    onClick={() => setShowDoctorPrescriptionModal(true)}
                  >
                    {savedPrescription ? '📄 Edit Prescription' : '📄 Create Prescription & Advice'}
                  </button>
                  <button
                    type="button"
                    className="hg-btn-completed-secondary"
                    onClick={() => navigate(getDashboardRoute())}
                  >
                    {savedPrescription ? 'Return to Dashboard' : 'Skip & Return to Dashboard'}
                  </button>
                </>
              ) : (
                <>
                  {savedPrescription ? (
                    <button
                      type="button"
                      className="hg-btn-completed-primary"
                      onClick={() => setShowPatientPrescriptionModal(true)}
                    >
                      📄 View Prescription
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={savedPrescription ? 'hg-btn-completed-secondary' : 'hg-btn-completed-primary'}
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

      {/* End Consultation Confirmation Modal */}
      {showEndCallConfirm && (
        <div
          className="hg-confirm-modal-overlay"
          onClick={() => !isEndingCall && setShowEndCallConfirm(false)}
          role="presentation"
        >
          <div
            className="hg-confirm-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hg-confirm-dialog-title"
          >
            <div className="hg-confirm-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </div>

            <h3 id="hg-confirm-dialog-title" className="hg-confirm-title">
              End Video Consultation?
            </h3>

            <p className="hg-confirm-message">
              Are you sure you want to end this video consultation? This will disconnect the call session for both participants.
            </p>

            <div className="hg-confirm-hint">
              {session?.userRole === 'doctor'
                ? '💡 You will proceed directly to the clinical prescription & advice screen.'
                : '💡 You will be able to review consultation records and doctor prescriptions.'}
            </div>

            <div className="hg-confirm-actions">
              <button
                type="button"
                className="hg-btn-confirm-cancel"
                onClick={() => setShowEndCallConfirm(false)}
                disabled={isEndingCall}
              >
                Stay in Call
              </button>
              <button
                type="button"
                className="hg-btn-confirm-danger"
                onClick={handleConfirmEndCall}
                disabled={isEndingCall}
              >
                {isEndingCall ? 'Ending...' : 'Yes, End Consultation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
