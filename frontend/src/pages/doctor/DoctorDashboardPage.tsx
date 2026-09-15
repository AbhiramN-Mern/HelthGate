import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDoctorDashboard,
  updateDoctorAvailabilityApi,
  updateAppointmentStatusApi,
  getDoctorBookedSlotsApi,
  requestAppointmentRescheduleApi,
  getMyDoctorHospitalsApi,
  startVideoCallApi,
  getFriendlyErrorMessage,
  type AuthUser,
  type DoctorProfile,
  type DoctorAvailability,
  type AppointmentItem,
  type NotificationItem,
  type Hospital,
  type HospitalDoctorItem,
} from '../../api/auth.api'
import { PrescriptionModal } from '../../components/prescription/PrescriptionModal'
import { Pagination } from '../../components/common/Pagination'
import './DoctorDashboardPage.css'
import {
  CalendarIcon,
  ClockIcon,
  StethoscopeIcon,
  UserIcon,
  UsersIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  BlockedIcon,
  CloseIcon,
  SettingsIcon,
  BellIcon,
  ClipboardIcon,
  HospitalIcon,
} from '../../components/common/Icons'

type DoctorDashboardPageProps = {
  user?: AuthUser | null
  onLogout: () => void
  onRequireAuth: () => void
}

const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DEFAULT_SLOTS = ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM']

function DoctorDashboardPage({ user, onLogout, onRequireAuth }: DoctorDashboardPageProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  // Dashboard Data States
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [stats, setStats] = useState({
    todayAppointments: 0,
    upcomingAppointments: 0,
    completedAppointments: 0,
    totalPatients: 0,
  })
  const [todayAppointments, setTodayAppointments] = useState<AppointmentItem[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentItem[]>([])

  // Dashboard appointments pagination
  const [todayPage, setTodayPage] = useState(1)
  const TODAY_PER_PAGE = 6
  const totalTodayPages = Math.ceil(todayAppointments.length / TODAY_PER_PAGE) || 1
  const pagedTodayAppointments = todayAppointments.slice(
    (todayPage - 1) * TODAY_PER_PAGE,
    todayPage * TODAY_PER_PAGE,
  )

  const [upcomingPage, setUpcomingPage] = useState(1)
  const UPCOMING_PER_PAGE = 6
  const totalUpcomingPages = Math.ceil(upcomingAppointments.length / UPCOMING_PER_PAGE) || 1
  const pagedUpcomingAppointments = upcomingAppointments.slice(
    (upcomingPage - 1) * UPCOMING_PER_PAGE,
    upcomingPage * UPCOMING_PER_PAGE,
  )

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [availability, setAvailability] = useState<DoctorAvailability>({
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '09:00 AM', end: '05:00 PM' },
    availableSlots: DEFAULT_SLOTS,
    blockedDates: [],
  })

  // Loading & Error States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [docFeedback, setDocFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // 5. Manage Availability Modal State
  const [showAvailModal, setShowAvailModal] = useState(false)
  const [availForm, setAvailForm] = useState<{
    workingDays: string[]
    startTime: string
    endTime: string
    availableSlots: string[]
    newSlotInput: string
    blockedDates: string[]
    newBlockedDateInput: string
    available: boolean
  }>({
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '09:00 AM',
    endTime: '05:00 PM',
    availableSlots: DEFAULT_SLOTS,
    newSlotInput: '',
    blockedDates: [],
    newBlockedDateInput: '',
    available: true,
  })
  const [availSubmitting, setAvailSubmitting] = useState(false)
  const [availFeedback, setAvailFeedback] = useState<string | null>(null)

  // 3. Consultation Modal State
  const [consultingAppt, setConsultingAppt] = useState<AppointmentItem | null>(null)
  const [consultNotes, setConsultNotes] = useState('')
  const [consultDiagnosis, setConsultDiagnosis] = useState('')
  const [consultSubmitting, setConsultSubmitting] = useState(false)

  // Early Video Consultation Confirmation Warning Modal State
  const [earlyCallAppt, setEarlyCallAppt] = useState<{
    appt: AppointmentItem
    timeStr: string
    dateStr: string
  } | null>(null)

  // End-of-Consultation Prescription Modal State
  const [prescriptionModalAppt, setPrescriptionModalAppt] = useState<AppointmentItem | null>(null)

  // Appointment Details Modal State
  const [viewingAppt, setViewingAppt] = useState<AppointmentItem | null>(null)

  // Reschedule Modal State
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<AppointmentItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('')
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState<string>('')
  const [rescheduleReason, setRescheduleReason] = useState<string>('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState<boolean>(false)
  const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState<string[]>([])
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState<boolean>(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null)

  // Hospital Affiliations (for header clinic summary)
  const [hospitalDocs, setHospitalDocs] = useState<HospitalDoctorItem[]>([])

  // Load Dashboard Data
  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }
    fetchDashboardData()
  }, [token])

  const fetchDoctorHospitals = async () => {
    try {
      const res = await getMyDoctorHospitalsApi(token)
      if (res.all) {
        setHospitalDocs(res.all)
      }
    } catch (e) {
      console.error('Failed to load doctor hospitals', e)
    }
  }

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      fetchDoctorHospitals()
      const data = await getDoctorDashboard(token)
      if (data.doctor) setDoctor(data.doctor)
      if (data.stats) setStats(data.stats)
      if (data.todayAppointments) setTodayAppointments(data.todayAppointments)
      if (data.upcomingAppointments) setUpcomingAppointments(data.upcomingAppointments)
      if (data.notifications) setNotifications(data.notifications)
      if (data.availability) {
        setAvailability(data.availability)
        setAvailForm((prev) => ({
          ...prev,
          workingDays: data.availability?.workingDays || prev.workingDays,
          startTime: data.availability?.workingHours?.start || prev.startTime,
          endTime: data.availability?.workingHours?.end || prev.endTime,
          availableSlots: data.availability?.availableSlots || prev.availableSlots,
          blockedDates: data.availability?.blockedDates || prev.blockedDates,
          available: data.doctor?.available ?? true,
        }))
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Unable to load doctor dashboard. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // Open Availability Manager
  const handleOpenAvailModal = () => {
    setAvailForm({
      workingDays: availability.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: availability.workingHours?.start || '09:00 AM',
      endTime: availability.workingHours?.end || '05:00 PM',
      availableSlots: availability.availableSlots || DEFAULT_SLOTS,
      newSlotInput: '',
      blockedDates: availability.blockedDates || [],
      newBlockedDateInput: '',
      available: doctor?.available ?? true,
    })
    setAvailFeedback(null)
    setShowAvailModal(true)
  }

  // Toggle Day in Availability
  const handleToggleDay = (day: string) => {
    setAvailForm((prev) => {
      const exists = prev.workingDays.includes(day)
      return {
        ...prev,
        workingDays: exists ? prev.workingDays.filter((d) => d !== day) : [...prev.workingDays, day],
      }
    })
  }

  // Add Time Slot
  const handleAddSlot = () => {
    if (!availForm.newSlotInput.trim()) return
    const formatted = availForm.newSlotInput.trim()
    if (!availForm.availableSlots.includes(formatted)) {
      setAvailForm((prev) => ({
        ...prev,
        availableSlots: [...prev.availableSlots, formatted],
        newSlotInput: '',
      }))
    }
  }

  // Remove Slot
  const handleRemoveSlot = (slot: string) => {
    setAvailForm((prev) => ({
      ...prev,
      availableSlots: prev.availableSlots.filter((s) => s !== slot),
    }))
  }

  // Add Blocked Date
  const handleAddBlockedDate = () => {
    if (!availForm.newBlockedDateInput) return
    if (!availForm.blockedDates.includes(availForm.newBlockedDateInput)) {
      setAvailForm((prev) => ({
        ...prev,
        blockedDates: [...prev.blockedDates, prev.newBlockedDateInput],
        newBlockedDateInput: '',
      }))
    }
  }

  // Remove Blocked Date
  const handleRemoveBlockedDate = (date: string) => {
    setAvailForm((prev) => ({
      ...prev,
      blockedDates: prev.blockedDates.filter((d) => d !== date),
    }))
  }

  // Save Availability to Backend
  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault()
    setAvailSubmitting(true)
    setAvailFeedback(null)

    try {
      const res = await updateDoctorAvailabilityApi(
        {
          workingDays: availForm.workingDays,
          workingHours: { start: availForm.startTime, end: availForm.endTime },
          availableSlots: availForm.availableSlots,
          blockedDates: availForm.blockedDates,
          available: availForm.available,
        },
        token,
      )

      if (res.availability) {
        setAvailability(res.availability)
      }
      if (res.available !== undefined && doctor) {
        setDoctor({ ...doctor, available: res.available })
      }

      setAvailFeedback('Availability updated successfully!')
      setTimeout(() => {
        setShowAvailModal(false)
        setAvailFeedback(null)
      }, 1200)
    } catch (err) {
      setAvailFeedback(err instanceof Error ? err.message : 'Failed to update availability')
    } finally {
      setAvailSubmitting(false)
    }
  }

  // Quick Toggle Active / Non-Active Status
  const handleToggleActiveStatus = async () => {
    if (!token || statusUpdating) return
    const nextStatus = !isOnline
    setStatusUpdating(true)
    setError(null)
    try {
      const res = await updateDoctorAvailabilityApi(
        {
          workingDays: availability.workingDays,
          workingHours: availability.workingHours,
          availableSlots: availability.availableSlots,
          blockedDates: availability.blockedDates,
          available: nextStatus,
        },
        token,
      )
      const finalStatus = res.available !== undefined ? res.available : nextStatus
      if (doctor) {
        setDoctor({ ...doctor, available: finalStatus })
      }
      setAvailForm((prev) => ({ ...prev, available: finalStatus }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update active status.')
    } finally {
      setStatusUpdating(false)
    }
  }

  const [startingCallApptId, setStartingCallApptId] = useState<string | null>(null)

  // Helper to dynamically check if scheduled appointment time has not arrived yet
  const checkIsEarlyConsultation = (appt: AppointmentItem): { isEarly: boolean; timeStr: string; dateStr: string } => {
    if (!appt.appointmentDate) return { isEarly: false, timeStr: '10:00 AM', dateStr: 'Today' }
    const dateObj = new Date(appt.appointmentDate)
    const timeSlot = (appt.timeSlot || '10:00 AM').trim()

    let hours = 10
    let minutes = 0
    const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (match) {
      let h = parseInt(match[1], 10)
      const m = parseInt(match[2], 10)
      const meridian = match[3]?.toUpperCase()
      if (meridian === 'PM' && h < 12) h += 12
      else if (meridian === 'AM' && h === 12) h = 0
      hours = h
      minutes = m
    }

    const scheduledDate = new Date(dateObj)
    scheduledDate.setHours(hours, minutes, 0, 0)
    const isEarly = new Date().getTime() < scheduledDate.getTime()

    const dateStr = dateObj.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    return { isEarly, timeStr: timeSlot, dateStr }
  }

  // Doctor clicks "Start Video Consultation"
  const handleInitiateVideoCallClick = (appt: AppointmentItem) => {
    const { isEarly, timeStr, dateStr } = checkIsEarlyConsultation(appt)
    if (isEarly) {
      setEarlyCallAppt({ appt, timeStr, dateStr })
    } else {
      handleStartVideoConsultation(appt)
    }
  }

  // Start Real-Time Video Consultation
  const handleStartVideoConsultation = async (appt: AppointmentItem) => {
    if (!appt._id) return
    setStartingCallApptId(appt._id)
    try {
      const result = await startVideoCallApi(appt._id, token)
      if (result.callSession?.id) {
        navigate(`/video-call/${result.callSession.id}`)
      } else {
        navigate(`/consultation/${appt._id}`)
      }
    } catch (err: any) {
      setDocFeedback({
        type: 'error',
        message: err.message || 'Failed to start video consultation. Please try again.',
      })
    } finally {
      setStartingCallApptId(null)
    }
  }

  // Start Consultation Modal
  const handleStartConsultation = (appt: AppointmentItem) => {
    setConsultingAppt(appt)
    setConsultNotes('')
    setConsultDiagnosis('')
  }

  // Complete Consultation
  const handleCompleteConsultation = async () => {
    if (!consultingAppt?._id) return
    setConsultSubmitting(true)

    try {
      await updateAppointmentStatusApi(consultingAppt._id, 'completed', token)
      // Update local state
      setTodayAppointments((prev) =>
        prev.map((a) => (a._id === consultingAppt._id ? { ...a, status: 'completed' } : a)),
      )
      setStats((prev) => ({
        ...prev,
        completedAppointments: prev.completedAppointments + 1,
      }))
      setConsultingAppt(null)
      setDocFeedback({ type: 'success', message: 'Consultation marked as completed successfully.' })
    } catch (err) {
      setDocFeedback({
        type: 'error',
        message: getFriendlyErrorMessage(err, 'Failed to update appointment status. Please try again.'),
      })
    } finally {
      setConsultSubmitting(false)
    }
  }

  // Fetch booked slots for reschedule modal
  const fetchBookedSlotsForDate = async (dateStr: string) => {
    if (!doctor?._id || !dateStr) return
    setRescheduleLoadingSlots(true)
    setRescheduleError(null)
    try {
      const res = await getDoctorBookedSlotsApi(doctor._id, { date: dateStr }, token)
      setRescheduleBookedSlots(res.bookedSlots || [])
    } catch (err) {
      console.warn('Failed to load doctor booked slots:', err)
    } finally {
      setRescheduleLoadingSlots(false)
    }
  }

  // Open Reschedule Modal
  const handleOpenRescheduleModal = (appt: AppointmentItem) => {
    setRescheduleModalAppt(appt)
    setRescheduleError(null)
    setRescheduleSuccess(null)
    setRescheduleReason(appt.rescheduleRequest?.reason || '')
    setRescheduleTimeSlot(appt.rescheduleRequest?.proposedTimeSlot || '')

    const targetDate = appt.rescheduleRequest?.proposedDate
      ? new Date(appt.rescheduleRequest.proposedDate).toISOString().split('T')[0]
      : (() => {
          const d = new Date()
          d.setDate(d.getDate() + 1)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })()

    setRescheduleDate(targetDate)
    fetchBookedSlotsForDate(targetDate)
  }

  // On date change in Reschedule Modal
  const handleDateChange = (newDate: string) => {
    setRescheduleDate(newDate)
    setRescheduleTimeSlot('')
    fetchBookedSlotsForDate(newDate)
  }

  // Submit Reschedule Request
  const handleSubmitReschedule = async () => {
    if (!rescheduleModalAppt?._id) return
    if (!rescheduleDate) {
      setRescheduleError('Please select a valid date.')
      return
    }
    if (!rescheduleTimeSlot) {
      setRescheduleError('Please select an available time slot.')
      return
    }

    setRescheduleSubmitting(true)
    setRescheduleError(null)
    setRescheduleSuccess(null)

    try {
      const res = await requestAppointmentRescheduleApi(
        rescheduleModalAppt._id,
        {
          newDate: rescheduleDate,
          newTimeSlot: rescheduleTimeSlot,
          reason: rescheduleReason || 'Doctor schedule adjustment',
        },
        token,
      )

      if (res.appointment) {
        const updated = res.appointment
        setTodayAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
        setUpcomingAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
        if (viewingAppt?._id === updated._id) setViewingAppt(updated)
      }

      setRescheduleSuccess(
        'Reschedule request submitted: Pending Patient Approval. The current confirmed appointment remains unchanged until the patient approves.',
      )
      setTimeout(() => {
        setRescheduleModalAppt(null)
        setRescheduleSuccess(null)
      }, 2500)

    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : 'Failed to request reschedule')
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  // Quick Action Scrollers
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  // Doctor Info
  const doctorName = doctor?.user?.name || user?.name || 'Doctor'
  const doctorSpecialization = doctor?.specialization || 'Medical Specialist'
  const activeHospitals = hospitalDocs.filter((h) => h.status === 'ACTIVE')
  const hospitalName = activeHospitals.length > 0
    ? (activeHospitals[0].hospital as Hospital)?.name + (activeHospitals.length > 1 ? ` (+${activeHospitals.length - 1} more)` : '')
    : (doctor?.hospital?.name || 'Independent / Freelance')
  const isOnline = doctor?.available ?? true

  return (
    <div className="dd-root">
      {/* ========================================================
          1. HEADER (Doctor name, photo, specialization, hospital, profile btn, logout)
          ======================================================== */}
      <header className="dd-header">
        <div className="dd-header-inner">
          {/* Brand */}
          <div className="dd-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="dd-brand-logo">HG</div>
            <div>
              <div className="dd-brand-title">HealthGate</div>
              <div className="dd-brand-tag">Physician Console</div>
            </div>
          </div>

          {/* Doctor Header Profile & Actions */}
          <div className="dd-header-profile">
            <div className="dd-doc-chip">
              {doctor?.profileImage ? (
                <img src={doctor.profileImage} alt={doctorName} className="dd-doc-avatar" />
              ) : (
                <div className="dd-doc-avatar">
                  {doctorName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                </div>
              )}
              <div className="dd-doc-text">
                <span className="dd-doc-name">Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}</span>
                <span className="dd-doc-sub">
                  <span className="dd-doc-spec-tag">{doctorSpecialization}</span>
                  <span>•</span>
                  <span className="dd-doc-hosp-tag">{hospitalName}</span>
                </span>
              </div>
            </div>

            <div className="dd-header-actions">
              {/* Quick Status Option (Active / Non-Active) */}
              <button
                id="doc-header-status-btn"
                type="button"
                className={`dd-header-status-pill ${isOnline ? 'active' : 'inactive'}`}
                onClick={handleToggleActiveStatus}
                disabled={statusUpdating}
                title={isOnline ? 'Currently Active. Click to set Non-Active' : 'Currently Non-Active. Click to set Active'}
              >
                <span className={`dd-status-dot-sm ${isOnline ? 'active' : 'inactive'}`} />
                <span>{statusUpdating ? 'Updating...' : isOnline ? 'Active' : 'Non-Active'}</span>
              </button>

              <button
                id="doc-nav-patients-btn"
                type="button"
                className="dd-btn-profile"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => navigate('/doctor/patients')}
                title="View Patients & Care History"
              >
                <UsersIcon size={15} />
                <span>Patients</span>
              </button>

              <button
                id="doc-nav-notifs-btn"
                type="button"
                className="dd-btn-profile"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  position: 'relative',
                }}
                onClick={() => navigate('/doctor/notifications')}
                title="View Alerts & Notifications"
              >
                <BellIcon size={15} />
                <span>Notifications</span>
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      lineHeight: '1.2',
                    }}
                  >
                    {notifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </button>

              <button
                id="doc-nav-profile-btn"
                type="button"
                className="dd-btn-profile"
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </button>

              <button
                id="doc-nav-logout-btn"
                type="button"
                className="dd-btn-logout"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          MAIN DASHBOARD BODY
          ======================================================== */}
      <main className="dd-main">
        {/* Doctor Feedback Banner */}
        {docFeedback && (
          <div
            className={`ppp-feedback-banner ${docFeedback.type}`}
            style={{ marginBottom: '16px' }}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {docFeedback.type === 'success' ? (
                <CheckCircleIcon size={18} />
              ) : (
                <AlertCircleIcon size={18} />
              )}
              <span>{docFeedback.message}</span>
            </div>
            <button
              type="button"
              className="ppp-feedback-close"
              onClick={() => setDocFeedback(null)}
              aria-label="Dismiss message"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        {/* Welcome Doctor Banner */}
        <div className="dd-welcome-banner">
          <div className="dd-welcome-text">
            <h1>Welcome, Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}</h1>
            <p>
              Your clinic overview for today. Monitor patient check-ins, manage appointment schedules,
              and update your availability across the HealthGate provider network.
            </p>
          </div>

          <div className="dd-welcome-status-card">
            <div className="dd-welcome-status-info">
              <span className={`dd-status-dot ${isOnline ? '' : 'offline'}`} />
              <div>
                <div className="dd-status-label">
                  {isOnline ? 'Active' : 'Non-Active'}
                </div>
                <div className="dd-status-sublabel">
                  {isOnline ? 'Accepting patient bookings' : 'Bookings paused / offline'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`dd-status-switch-btn ${isOnline ? 'active' : 'inactive'}`}
              onClick={handleToggleActiveStatus}
              disabled={statusUpdating}
            >
              {statusUpdating ? 'Saving...' : isOnline ? 'Set Non-Active' : 'Set Active'}
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1.5px solid #fecaca',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangleIcon size={16} /> {error}
            </span>
            <button
              type="button"
              className="dd-btn-profile"
              onClick={fetchDashboardData}
              style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ========================================================
            2. OVERVIEW / STATS (Today's, Upcoming, Completed, Total Patients)
            ======================================================== */}
        <section id="overview" className="dd-section" aria-label="Dashboard Overview">
          <div className="dd-section-header">
            <div className="dd-section-title-wrap">
              <span className="dd-section-tag">Performance Summary</span>
              <h2 className="dd-section-title">Overview & Statistics</h2>
            </div>
          </div>

          <div className="dd-stats-grid">
            <div className="dd-stat-card" onClick={() => scrollToSection('today-appointments')}>
              <div className="dd-stat-icon-wrap today"><CalendarIcon size={20} /></div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.todayAppointments}</span>
                <span className="dd-stat-label">Today's Appointments</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => scrollToSection('upcoming-appointments')}>
              <div className="dd-stat-icon-wrap upcoming"><ClockIcon size={20} /></div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.upcomingAppointments}</span>
                <span className="dd-stat-label">Upcoming</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => scrollToSection('today-appointments')}>
              <div className="dd-stat-icon-wrap completed"><CheckCircleIcon size={20} /></div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.completedAppointments}</span>
                <span className="dd-stat-label">Completed</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => navigate('/doctor/patients')}>
              <div className="dd-stat-icon-wrap patients"><UsersIcon size={20} /></div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.totalPatients}</span>
                <span className="dd-stat-label">Total Patients</span>
              </div>
            </div>

            <div
              className="dd-stat-card"
              onClick={() => navigate('/profile?tab=hospitals')}
              title="Manage Hospital Affiliations in your Doctor Profile"
            >
              <div className="dd-stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}><HospitalIcon size={20} /></div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : activeHospitals.length}</span>
                <span className="dd-stat-label">Affiliated Hospitals</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            7. QUICK ACTIONS
            ======================================================== */}
        <section className="dd-section" aria-label="Quick Actions">
          <div className="dd-section-header">
            <div className="dd-section-title-wrap">
              <span className="dd-section-tag">Shortcuts</span>
              <h2 className="dd-section-title">Quick Actions</h2>
            </div>
          </div>

          <div className="dd-quick-actions-grid">
            <button
              id="doc-quick-manage-avail-btn"
              type="button"
              className="dd-quick-btn"
              onClick={handleOpenAvailModal}
            >
              <span className="dd-quick-icon"><ClockIcon size={18} /></span>
              <span>Manage Availability</span>
            </button>

            <button
              id="doc-quick-view-appts-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => scrollToSection('today-appointments')}
            >
              <span className="dd-quick-icon"><ClipboardIcon size={18} /></span>
              <span>View Appointments</span>
            </button>

            <button
              id="doc-quick-hospitals-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => navigate('/profile?tab=hospitals')}
              title="Manage Hospital Affiliations in your Doctor Profile"
            >
              <span className="dd-quick-icon"><HospitalIcon size={18} /></span>
              <span>Hospital Affiliations</span>
            </button>

            <button
              id="doc-quick-edit-profile-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => navigate('/profile')}
            >
              <span className="dd-quick-icon"><StethoscopeIcon size={18} /></span>
              <span>Edit Profile</span>
            </button>

            <button
              id="doc-quick-view-patients-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => navigate('/doctor/patients')}
            >
              <span className="dd-quick-icon"><UserIcon size={18} /></span>
              <span>View Patients</span>
            </button>

            <button
              id="doc-quick-view-notifs-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => navigate('/doctor/notifications')}
            >
              <span className="dd-quick-icon"><BellIcon size={18} /></span>
              <span>
                Alerts & Updates
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span
                    style={{
                      marginLeft: '6px',
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {notifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </section>



        {/* ========================================================
            3. TODAY'S APPOINTMENTS (Patient, Time, Status, Type, Details, Start Consultation)
            ======================================================== */}
        <section id="today-appointments" className="dd-section" aria-label="Today's Appointments">
          <div className="dd-section-header">
            <div className="dd-section-title-wrap">
              <span className="dd-section-tag">Today's Schedule</span>
              <h2 className="dd-section-title">Today's Appointments</h2>
            </div>
            <span className="dd-section-badge">{todayAppointments.length} Today</span>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="dd-empty-state">
              <span className="dd-empty-icon"><CalendarIcon size={32} /></span>
              <h3 className="dd-empty-title">No appointments scheduled for today</h3>
              <p className="dd-empty-desc">
                Patients who book slots for today will automatically appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="dd-appointments-grid">
                {pagedTodayAppointments.map((appt) => {
                const patientName = appt.patient?.name || 'Patient'
                const statusClass = appt.status || 'scheduled'
                const isCompleted = appt.status === 'completed'

                return (
                  <div key={appt._id} className="dd-appointment-card">
                    <div className="dd-appt-top">
                      <div className="dd-patient-chip">
                        <div className="dd-patient-avatar">
                          {patientName.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="dd-patient-info">
                          <h4 className="dd-patient-name">{patientName}</h4>
                          <span className="dd-patient-meta">{appt.patient?.email || 'Registered Patient'}</span>
                        </div>
                      </div>

                      <div className="dd-appt-top-badges">
                        {appt.consultationType === 'offline' ? (
                          <div className="dd-offline-badge-group">
                            <span className="dd-badge-consult-format offline">
                              🏥 Offline Visit
                            </span>
                            <span className="dd-badge-token">
                              🎫 #{appt.tokenNumber || 'OPD-1'}
                            </span>
                            {appt.cabinNumber && (
                              <span className="dd-badge-cabin">
                                🚪 {appt.cabinNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="dd-badge-consult-format video">
                            📹 Online Video
                          </span>
                        )}
                        <span className={`dd-status-pill ${statusClass}`}>
                          ● {appt.status || 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <div className="dd-appt-details-row">
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Appointment Time</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <ClockIcon size={14} /> {appt.timeSlot || '10:00 AM'}
                        </span>
                      </div>
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Visit Format</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <StethoscopeIcon size={14} /> {appt.type || 'In-Person'}
                        </span>
                      </div>
                      <div className="dd-detail-cell" style={{ gridColumn: '1 / -1' }}>
                        <span className="dd-detail-label">Practice Venue</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {appt.hospital ? (
                            <>
                              <HospitalIcon size={13} />
                              <span>{(appt.hospital as any)?.name || 'Hospital'} {appt.department ? `(${appt.department})` : ''}</span>
                            </>
                          ) : (
                            <>
                              <StethoscopeIcon size={13} />
                              <span style={{ color: '#0d5c63' }}>Independent / Freelance</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {appt.rescheduleRequest?.status === 'pending' && (
                      <div className="dd-reschedule-banner">
                        <span className="dd-reschedule-tag" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          <ClockIcon size={12} /> Pending Patient Approval
                        </span>
                        <span className="dd-reschedule-desc">
                          Proposed: {appt.rescheduleRequest.proposedDate ? new Date(appt.rescheduleRequest.proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} at {appt.rescheduleRequest.proposedTimeSlot}
                        </span>
                      </div>
                    )}

                    <div className="dd-appt-actions">
                      <button
                        type="button"
                        className="dd-btn-view-details"
                        onClick={() => setViewingAppt(appt)}
                      >
                        View Details
                      </button>

                      {!isCompleted && appt.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="dd-btn-reschedule"
                          onClick={() => handleOpenRescheduleModal(appt)}
                          title="Propose a new date and time slot"
                        >
                          <CalendarIcon size={13} /> {appt.rescheduleRequest?.status === 'pending' ? 'Change' : 'Reschedule'}
                        </button>
                      )}

                      {appt.consultationType !== 'offline' && !isCompleted && appt.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="dd-btn-consult video"
                          disabled={startingCallApptId === appt._id}
                          onClick={() => handleInitiateVideoCallClick(appt)}
                          title="Start Video Consultation (Available anytime)"
                        >
                          {startingCallApptId === appt._id ? 'Connecting...' : '📹 Start Video Consultation'}
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          className="dd-btn-consult prescription"
                          onClick={() => setPrescriptionModalAppt(appt)}
                        >
                          📄 Prescription
                        </button>
                      )}

                      {!isCompleted && (
                        <button
                          type="button"
                          className="dd-btn-consult"
                          onClick={() => handleStartConsultation(appt)}
                        >
                          Clinical Notes
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
              <Pagination
                currentPage={todayPage}
                totalPages={totalTodayPages}
                onPageChange={setTodayPage}
                totalItems={todayAppointments.length}
                itemsPerPage={TODAY_PER_PAGE}
              />
            </>
          )}
        </section>

        {/* ========================================================
            4. UPCOMING APPOINTMENTS (Date, Time, Patient, Status, View Details)
            ======================================================== */}
        <section id="upcoming-appointments" className="dd-section" aria-label="Upcoming Appointments">
          <div className="dd-section-header">
            <div className="dd-section-title-wrap">
              <span className="dd-section-tag">Future Consultations</span>
              <h2 className="dd-section-title">Upcoming Appointments</h2>
            </div>
            <span className="dd-section-badge">{upcomingAppointments.length} Upcoming</span>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="dd-empty-state">
              <span className="dd-empty-icon"><CalendarIcon size={32} /></span>
              <h3 className="dd-empty-title">No upcoming appointments booked</h3>
              <p className="dd-empty-desc">
                Future reservations scheduled by patients will be displayed in this section.
              </p>
            </div>
          ) : (
            <>
              <div className="dd-appointments-grid">
                {pagedUpcomingAppointments.map((appt) => {
                const patientName = appt.patient?.name || 'Patient'
                const formattedDate = appt.appointmentDate
                  ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Date TBD'

                return (
                  <div key={appt._id} className="dd-appointment-card">
                    <div className="dd-appt-top">
                      <div className="dd-patient-chip">
                        <div className="dd-patient-avatar" style={{ background: '#0284c7' }}>
                          {patientName.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="dd-patient-info">
                          <h4 className="dd-patient-name">{patientName}</h4>
                          <span className="dd-patient-meta">{appt.patient?.email || 'Patient'}</span>
                        </div>
                      </div>

                      <div className="dd-appt-top-badges">
                        {appt.consultationType === 'offline' ? (
                          <div className="dd-offline-badge-group">
                            <span className="dd-badge-consult-format offline">
                              🏥 Offline Visit
                            </span>
                            <span className="dd-badge-token">
                              🎫 #{appt.tokenNumber || 'OPD-1'}
                            </span>
                            {appt.cabinNumber && (
                              <span className="dd-badge-cabin">
                                🚪 {appt.cabinNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="dd-badge-consult-format video">
                            📹 Online Video
                          </span>
                        )}
                        <span className={`dd-status-pill ${appt.status || 'scheduled'}`}>
                          ● {appt.status || 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <div className="dd-appt-details-row">
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Date & Time</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <CalendarIcon size={14} /> {formattedDate} • {appt.timeSlot || '10:00 AM'}
                        </span>
                      </div>
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Type</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <StethoscopeIcon size={14} /> {appt.type || 'In-Person'}
                        </span>
                      </div>
                      <div className="dd-detail-cell" style={{ gridColumn: '1 / -1' }}>
                        <span className="dd-detail-label">Practice Venue</span>
                        <span className="dd-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {appt.hospital ? (
                            <>
                              <HospitalIcon size={13} />
                              <span>{(appt.hospital as any)?.name || 'Hospital'} {appt.department ? `(${appt.department})` : ''}</span>
                            </>
                          ) : (
                            <>
                              <StethoscopeIcon size={13} />
                              <span style={{ color: '#0d5c63' }}>Independent / Freelance</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {appt.rescheduleRequest?.status === 'pending' && (
                      <div className="dd-reschedule-banner">
                        <span className="dd-reschedule-tag" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          <ClockIcon size={12} /> Pending Patient Approval
                        </span>
                        <span className="dd-reschedule-desc">
                          Proposed: {appt.rescheduleRequest.proposedDate ? new Date(appt.rescheduleRequest.proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} at {appt.rescheduleRequest.proposedTimeSlot}
                        </span>
                      </div>
                    )}

                    <div className="dd-appt-actions">
                      <button
                        type="button"
                        className="dd-btn-view-details"
                        onClick={() => setViewingAppt(appt)}
                      >
                        View Details
                      </button>

                      {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="dd-btn-reschedule"
                          onClick={() => handleOpenRescheduleModal(appt)}
                        >
                          <CalendarIcon size={13} /> {appt.rescheduleRequest?.status === 'pending' ? 'Change' : 'Reschedule'}
                        </button>
                      )}

                      {appt.consultationType !== 'offline' && appt.status !== 'completed' && appt.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="dd-btn-consult video"
                          disabled={startingCallApptId === appt._id}
                          onClick={() => handleInitiateVideoCallClick(appt)}
                          title="Start Video Consultation (Doctor can start anytime)"
                        >
                          {startingCallApptId === appt._id ? 'Connecting...' : '📹 Video Call'}
                        </button>
                      )}

                      {appt.status === 'completed' && (
                        <button
                          type="button"
                          className="dd-btn-consult prescription"
                          onClick={() => setPrescriptionModalAppt(appt)}
                        >
                          📄 Prescription
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
              <Pagination
                currentPage={upcomingPage}
                totalPages={totalUpcomingPages}
                onPageChange={setUpcomingPage}
                totalItems={upcomingAppointments.length}
                itemsPerPage={UPCOMING_PER_PAGE}
              />
            </>
          )}
        </section>

        {/* ========================================================
            5. AVAILABILITY (Working Days, Working Hours, Slots, Blocked Dates, Manage Button)
            ======================================================== */}
        <section id="availability" className="dd-section" aria-label="Practice Availability">
          <div className="dd-section-header">
            <div className="dd-section-title-wrap">
              <span className="dd-section-tag">Schedule Setup</span>
              <h2 className="dd-section-title">Availability & Office Hours</h2>
            </div>
            <button
              id="doc-manage-avail-btn"
              type="button"
              className="dd-btn-manage-avail"
              onClick={handleOpenAvailModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <SettingsIcon size={15} /> Manage Availability
            </button>
          </div>

          <div className="dd-avail-card">
            <div className="dd-avail-block">
              <span className="dd-avail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CalendarIcon size={15} /> Working Days
              </span>
              <div className="dd-days-pills">
                {availability.workingDays && availability.workingDays.length > 0 ? (
                  availability.workingDays.map((d) => (
                    <span key={d} className="dd-day-pill">
                      {d.slice(0, 3)}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>None specified</span>
                )}
              </div>
            </div>

            <div className="dd-avail-block">
              <span className="dd-avail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ClockIcon size={15} /> Working Hours
              </span>
              <span className="dd-avail-hours-val">
                {availability.workingHours?.start || '09:00 AM'} -{' '}
                {availability.workingHours?.end || '05:00 PM'}
              </span>
            </div>

            <div className="dd-avail-block">
              <span className="dd-avail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ClockIcon size={15} /> Consultation Slots
              </span>
              <div className="dd-slots-pills">
                {availability.availableSlots && availability.availableSlots.length > 0 ? (
                  availability.availableSlots.map((s) => (
                    <span key={s} className="dd-slot-pill">
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>None specified</span>
                )}
              </div>
            </div>

            <div className="dd-avail-block">
              <span className="dd-avail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <BlockedIcon size={15} /> Blocked Dates
              </span>
              <div className="dd-slots-pills">
                {availability.blockedDates && availability.blockedDates.length > 0 ? (
                  availability.blockedDates.map((d) => (
                    <span
                      key={d}
                      className="dd-slot-pill"
                      style={{ background: '#fee2e2', color: '#991b1b' }}
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircleIcon size={14} /> No blocked dates
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ========================================================
          MODALS
          ======================================================== */}

      {/* 5. MANAGE AVAILABILITY MODAL */}
      {showAvailModal && (
        <div className="dd-modal-overlay" onClick={() => setShowAvailModal(false)}>
          <div className="dd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-header">
              <div>
                <span className="dd-section-tag">Practice Schedule</span>
                <h3 className="dd-modal-title">Manage Availability</h3>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => setShowAvailModal(false)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {availFeedback && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {availFeedback}
              </div>
            )}

            <form className="dd-modal-form" onSubmit={handleSaveAvailability}>
              {/* Active / Non-Active Status Selector */}
              <div className="dd-form-group">
                <label className="dd-form-label">Doctor Practice Status</label>
                <div className="dd-status-options-grid">
                  <button
                    type="button"
                    className={`dd-status-option-btn ${availForm.available ? 'selected active' : ''}`}
                    onClick={() => setAvailForm((prev) => ({ ...prev, available: true }))}
                  >
                    <span className="dd-status-dot" />
                    <div>
                      <strong>Active (Online)</strong>
                      <span>Available for appointments and patient consultations</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`dd-status-option-btn ${!availForm.available ? 'selected inactive' : ''}`}
                    onClick={() => setAvailForm((prev) => ({ ...prev, available: false }))}
                  >
                    <span className="dd-status-dot offline" />
                    <div>
                      <strong>Non-Active (Offline)</strong>
                      <span>Temporarily pause bookings and mark unavailable</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Working Days Selector */}
              <div className="dd-form-group">
                <label className="dd-form-label">Select Working Days</label>
                <div className="dd-days-selector">
                  {ALL_WEEKDAYS.map((day) => {
                    const isSelected = availForm.workingDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`dd-day-toggle ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleDay(day)}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Working Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="dd-form-group">
                  <label className="dd-form-label">Start Time</label>
                  <input
                    type="text"
                    value={availForm.startTime}
                    onChange={(e) => setAvailForm({ ...availForm, startTime: e.target.value })}
                    placeholder="09:00 AM"
                    className="dd-form-input"
                  />
                </div>

                <div className="dd-form-group">
                  <label className="dd-form-label">End Time</label>
                  <input
                    type="text"
                    value={availForm.endTime}
                    onChange={(e) => setAvailForm({ ...availForm, endTime: e.target.value })}
                    placeholder="05:00 PM"
                    className="dd-form-input"
                  />
                </div>
              </div>

              {/* Available Slots */}
              <div className="dd-form-group">
                <label className="dd-form-label">Available Slots</label>
                <div className="dd-slots-pills" style={{ marginBottom: '8px' }}>
                  {availForm.availableSlots.map((slot) => (
                    <span
                      key={slot}
                      className="dd-slot-pill"
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => handleRemoveSlot(slot)}
                      title="Click to remove"
                    >
                      {slot} <CloseIcon size={11} />
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. 04:00 PM"
                    value={availForm.newSlotInput}
                    onChange={(e) => setAvailForm({ ...availForm, newSlotInput: e.target.value })}
                    className="dd-form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="dd-btn-profile"
                    style={{ background: '#0d5c63', color: '#fff' }}
                    onClick={handleAddSlot}
                  >
                    + Add Slot
                  </button>
                </div>
              </div>

              {/* Blocked Dates */}
              <div className="dd-form-group">
                <label className="dd-form-label">Blocked Dates (Leaves / Holidays)</label>
                {availForm.blockedDates.length > 0 && (
                  <div className="dd-slots-pills" style={{ marginBottom: '8px' }}>
                    {availForm.blockedDates.map((date) => (
                      <span
                        key={date}
                        className="dd-slot-pill"
                        style={{ background: '#fee2e2', color: '#991b1b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => handleRemoveBlockedDate(date)}
                        title="Click to remove"
                      >
                        {date} <CloseIcon size={11} />
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={availForm.newBlockedDateInput}
                    onChange={(e) => setAvailForm({ ...availForm, newBlockedDateInput: e.target.value })}
                    className="dd-form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="dd-btn-profile"
                    onClick={handleAddBlockedDate}
                  >
                    + Block Date
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="dd-btn-submit"
                disabled={availSubmitting}
              >
                {availSubmitting ? 'Saving...' : 'Save Availability'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. START CONSULTATION MODAL */}
      {consultingAppt && (
        <div className="dd-modal-overlay" onClick={() => setConsultingAppt(null)}>
          <div className="dd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-header">
              <div>
                <span className="dd-section-tag">Active Session</span>
                <h3 className="dd-modal-title">Consultation Room</h3>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => setConsultingAppt(null)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: '#f0f9f8',
                border: '1px solid rgba(13, 92, 99, 0.12)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0d5c63' }}>
                {consultingAppt.patient?.name || 'Patient'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                {consultingAppt.type || 'In-Person'} • {consultingAppt.timeSlot || '10:00 AM'}
              </div>
              {consultingAppt.reason && (
                <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '6px', fontStyle: 'italic' }}>
                  "{consultingAppt.reason}"
                </div>
              )}
            </div>

            <div className="dd-modal-form">
              <div className="dd-form-group">
                <label className="dd-form-label">Clinical Observations & Diagnosis</label>
                <input
                  type="text"
                  placeholder="Primary diagnosis or chief complaint..."
                  value={consultDiagnosis}
                  onChange={(e) => setConsultDiagnosis(e.target.value)}
                  className="dd-form-input"
                />
              </div>

              <div className="dd-form-group">
                <label className="dd-form-label">Doctor Notes & Recommendations</label>
                <textarea
                  rows={4}
                  placeholder="Enter medical advice, prescriptions, or follow-up instructions..."
                  value={consultNotes}
                  onChange={(e) => setConsultNotes(e.target.value)}
                  className="dd-form-textarea"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="dd-btn-submit"
                  style={{ flex: 1 }}
                  disabled={consultSubmitting}
                  onClick={handleCompleteConsultation}
                >
                  {consultSubmitting ? 'Finalizing...' : 'Complete Consultation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPOINTMENT DETAILS MODAL */}
      {viewingAppt && (
        <div className="dd-modal-overlay" onClick={() => setViewingAppt(null)}>
          <div className="dd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-header">
              <div>
                <span className="dd-section-tag">Appointment Information</span>
                <h3 className="dd-modal-title">Consultation Details</h3>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => setViewingAppt(null)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Patient
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1b2430' }}>
                  {viewingAppt.patient?.name || 'Patient'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {viewingAppt.patient?.email || 'N/A'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Date</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {viewingAppt.appointmentDate ? new Date(viewingAppt.appointmentDate).toLocaleDateString() : 'Today'}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Time Slot</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {viewingAppt.timeSlot || '10:00 AM'}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Status</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                    {viewingAppt.status || 'Scheduled'}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Consultation Format</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span>{viewingAppt.consultationType === 'offline' ? '🏥 Offline Visit' : '📹 Online Video'}</span>
                    {viewingAppt.consultationType === 'offline' && (
                      <>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                          🎫 Token #{viewingAppt.tokenNumber || 'OPD-1'}
                        </span>
                        {viewingAppt.cabinNumber && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>
                            🚪 Room: {viewingAppt.cabinNumber}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {viewingAppt.reason && (
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Reason for Visit</span>
                  <div style={{ fontSize: '0.9rem', marginTop: '3px' }}>
                    {viewingAppt.reason}
                  </div>
                </div>
              )}

              {viewingAppt.rescheduleRequest?.status === 'pending' && (
                <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                  <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircleIcon size={16} /> Pending Patient Approval
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '4px' }}>
                    Proposed: {viewingAppt.rescheduleRequest.proposedDate ? new Date(viewingAppt.rescheduleRequest.proposedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''} at {viewingAppt.rescheduleRequest.proposedTimeSlot}
                    {viewingAppt.rescheduleRequest.reason && ` • "${viewingAppt.rescheduleRequest.reason}"`}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#78350f', marginTop: '4px', fontStyle: 'italic' }}>
                    Awaiting patient confirmation. The original confirmed schedule remains active until accepted.
                  </div>
                </div>
              )}

              {viewingAppt.status === 'completed' && (
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className="dd-btn-consult"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #0d5c63 0%, #088395 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    onClick={() => {
                      const target = viewingAppt
                      setViewingAppt(null)
                      setPrescriptionModalAppt(target)
                    }}
                  >
                    📄 View / Edit Prescription
                  </button>
                </div>
              )}

              {viewingAppt.status !== 'completed' && viewingAppt.status !== 'cancelled' && (
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className="dd-btn-reschedule"
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem' }}
                    onClick={() => {
                      const target = viewingAppt
                      setViewingAppt(null)
                      handleOpenRescheduleModal(target)
                    }}
                  >
                    <CalendarIcon size={14} /> {viewingAppt.rescheduleRequest?.status === 'pending' ? 'Change Proposed Reschedule' : 'Reschedule Appointment'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. DOCTOR RESCHEDULE APPOINTMENT MODAL */}
      {rescheduleModalAppt && (
        <div className="dd-modal-overlay" onClick={() => setRescheduleModalAppt(null)}>
          <div
            className="dd-modal-card"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dd-modal-header">
              <div>
                <span className="dd-section-tag">Appointment Rescheduling</span>
                <h3 className="dd-modal-title">Propose New Schedule</h3>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => setRescheduleModalAppt(null)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Current Schedule Summary */}
            <div
              style={{
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                Current Confirmed Appointment
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1b2430' }}>
                {rescheduleModalAppt.patient?.name || 'Patient'}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CalendarIcon size={14} />{' '}
                {rescheduleModalAppt.appointmentDate
                  ? new Date(rescheduleModalAppt.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Today'}{' '}
                • <ClockIcon size={14} /> {rescheduleModalAppt.timeSlot || '10:00 AM'}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#0369a1',
                  background: '#e0f2fe',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  marginTop: '4px',
                  width: 'fit-content',
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                ● Every doctor-initiated reschedule requires patient approval. The request will show as "Pending Patient Approval" and the current schedule remains active until accepted.
              </div>
            </div>


            {/* Error or Success message */}
            {rescheduleError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircleIcon size={16} /> {rescheduleError}
              </div>
            )}
            {rescheduleSuccess && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircleIcon size={18} /> {rescheduleSuccess}
              </div>
            )}

            {!rescheduleSuccess && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSubmitReschedule()
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {/* 1. Pick Date */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    1. Select New Date (Within 90 Days)
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    max={(() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 90)
                      return d.toISOString().split('T')[0]
                    })()}
                    value={rescheduleDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      background: '#ffffff',
                    }}
                  />
                  {doctor?.availability?.blockedDates?.includes(rescheduleDate) && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#b91c1c',
                        fontWeight: 600,
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      ⚠️ You have marked this date as blocked/leave in your availability settings.
                    </span>
                  )}
                </div>

                {/* 2. Pick Time Slot */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      2. Select Available Time Slot
                    </label>
                    {rescheduleLoadingSlots && (
                      <span style={{ fontSize: '0.75rem', color: '#0ea5a4' }}>
                        Verifying slot availability...
                      </span>
                    )}
                  </div>

                  <div className="dd-slots-picker-grid">
                    {(doctor?.availability?.availableSlots?.length
                      ? doctor.availability.availableSlots
                      : DEFAULT_SLOTS
                    ).map((slot) => {
                      const isBooked = rescheduleBookedSlots.includes(slot)
                      const isSelected = rescheduleTimeSlot === slot

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          className={`dd-slot-pick-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setRescheduleTimeSlot(slot)}
                        >
                          <span>{slot}</span>
                          <span className="dd-slot-status-label">
                            {isBooked ? 'Booked' : isSelected ? 'Selected' : 'Open'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Reason for Rescheduling */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    3. Reason for Reschedule (Sent to Patient)
                  </label>
                  <div className="dd-preset-chips" style={{ marginBottom: '8px' }}>
                    {[
                      'Emergency Surgery / On-Call Duty',
                      'Doctor Schedule Conflict',
                      'Hospital Staffing Adjustment',
                      'Clinic Equipment Maintenance',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`dd-preset-chip ${rescheduleReason === preset ? 'active' : ''}`}
                        onClick={() => setRescheduleReason(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Briefly explain the reason for the reschedule..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end',
                    marginTop: '6px',
                  }}
                >
                  <button
                    type="button"
                    className="dd-btn-view-details"
                    onClick={() => setRescheduleModalAppt(null)}
                    disabled={rescheduleSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="dd-btn-consult"
                    disabled={rescheduleSubmitting || !rescheduleDate || !rescheduleTimeSlot}
                    style={{ flex: 'none', minWidth: '190px' }}
                  >
                    {rescheduleSubmitting ? 'Sending Request...' : 'Send Reschedule Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}



      {/* EARLY VIDEO CONSULTATION CONFIRMATION MODAL */}
      {earlyCallAppt && (
        <div className="dd-modal-overlay" onClick={() => setEarlyCallAppt(null)}>
          <div className="dd-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div
              className="dd-modal-header"
              style={{
                borderBottom: '1px solid #fed7aa',
                background: '#fffbeb',
                borderRadius: '12px 12px 0 0',
                margin: '-24px -24px 20px -24px',
                padding: '16px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>
                  <h3 className="dd-modal-title" style={{ color: '#9a3412', fontSize: '1.15rem' }}>
                    Appointment Time Has Not Started Yet
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#c2410c' }}>Early Consultation Notice</span>
                </div>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => setEarlyCallAppt(null)}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', color: '#334155', fontSize: '0.92rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 12px 0' }}>
                This consultation with <strong>{earlyCallAppt.appt.patient?.name || 'the patient'}</strong> is scheduled for:
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#0d5c63', marginBottom: '4px' }}>
                  <CalendarIcon size={15} /> <span>{earlyCallAppt.dateStr}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.88rem' }}>
                  <ClockIcon size={15} /> <span>Scheduled Slot: {earlyCallAppt.timeStr}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                You can proceed to start the video call right now. HealthGate will immediately notify the patient that the doctor is ready to consult early.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="dd-btn-view-details"
                onClick={() => setEarlyCallAppt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="dd-btn-consult"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
                disabled={startingCallApptId === earlyCallAppt.appt._id}
                onClick={() => {
                  const targetAppt = earlyCallAppt.appt
                  setEarlyCallAppt(null)
                  handleStartVideoConsultation(targetAppt)
                }}
              >
                {startingCallApptId === earlyCallAppt.appt._id ? 'Connecting...' : 'Start Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END-OF-CONSULTATION PRESCRIPTION MODAL */}
      {prescriptionModalAppt && (
        <PrescriptionModal
          isOpen={!!prescriptionModalAppt}
          appointment={prescriptionModalAppt}
          token={token}
          onClose={() => setPrescriptionModalAppt(null)}
          onSaved={(_savedPrescription) => {
            setDocFeedback({ type: 'success', message: 'Prescription saved successfully.' })
            fetchDashboardData()
          }}
        />
      )}
    </div>
  )
}

export default DoctorDashboardPage
