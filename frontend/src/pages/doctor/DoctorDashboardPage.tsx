import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDoctorDashboard,
  updateDoctorAvailabilityApi,
  updateAppointmentStatusApi,
  getDoctorPatientDetailsApi,
  markNotificationReadApi,
  type AuthUser,
  type DoctorProfile,
  type DoctorAvailability,
  type AppointmentItem,
  type NotificationItem,
} from '../../api/auth.api'
import './DoctorDashboardPage.css'

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
  const [recentPatients, setRecentPatients] = useState<
    {
      patientId: string
      name: string
      email: string
      lastAppointmentDate: string
      lastAppointmentStatus: string
      appointmentType: string
      totalVisits: number
    }[]
  >([])
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

  // Appointment Details Modal State
  const [viewingAppt, setViewingAppt] = useState<AppointmentItem | null>(null)

  // 6. Patient Details Modal State (Protected View)
  const [patientModalLoading, setPatientModalLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string
    name: string
    email: string
    gender?: string
    phone?: string
    bloodGroup?: string
    dateOfBirth?: string
    address?: string
  } | null>(null)
  const [patientAppointments, setPatientAppointments] = useState<AppointmentItem[]>([])

  // Load Dashboard Data
  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }
    fetchDashboardData()
  }, [token])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDoctorDashboard(token)
      if (data.doctor) setDoctor(data.doctor)
      if (data.stats) setStats(data.stats)
      if (data.todayAppointments) setTodayAppointments(data.todayAppointments)
      if (data.upcomingAppointments) setUpcomingAppointments(data.upcomingAppointments)
      if (data.recentPatients) setRecentPatients(data.recentPatients)
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
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.')
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update appointment status')
    } finally {
      setConsultSubmitting(false)
    }
  }

  // View Patient Details (Safely fetched without leaking medical records on cards)
  const handleViewPatientDetails = async (patientId: string) => {
    setPatientModalLoading(true)
    setSelectedPatient(null)
    setPatientAppointments([])

    try {
      const data = await getDoctorPatientDetailsApi(patientId, token)
      if (data.patient) setSelectedPatient(data.patient)
      if (data.appointments) setPatientAppointments(data.appointments)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to load patient details')
    } finally {
      setPatientModalLoading(false)
    }
  }

  // Mark Notification Read
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await markNotificationReadApi(id, token)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)))
    } catch (err) {
      console.warn('Failed to mark notification read:', err)
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
  const hospitalName = doctor?.hospital?.name || 'Accredited Medical Center'
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
        {/* Welcome Doctor Banner */}
        <div className="dd-welcome-banner">
          <div className="dd-welcome-text">
            <h1>Welcome, Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}</h1>
            <p>
              Your clinic overview for today. Monitor patient check-ins, manage appointment schedules,
              and update your availability across the HealthGate provider network.
            </p>
          </div>

          <div className="dd-welcome-status">
            <span className={`dd-status-dot ${isOnline ? '' : 'offline'}`} />
            <span className="dd-status-label">
              {isOnline ? 'Active & Accepting Patients' : 'Temporarily Offline'}
            </span>
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
            <span>⚠️ {error}</span>
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
              <div className="dd-stat-icon-wrap today">📅</div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.todayAppointments}</span>
                <span className="dd-stat-label">Today's Appointments</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => scrollToSection('upcoming-appointments')}>
              <div className="dd-stat-icon-wrap upcoming">⏳</div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.upcomingAppointments}</span>
                <span className="dd-stat-label">Upcoming</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => scrollToSection('recent-patients')}>
              <div className="dd-stat-icon-wrap completed">✅</div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.completedAppointments}</span>
                <span className="dd-stat-label">Completed</span>
              </div>
            </div>

            <div className="dd-stat-card" onClick={() => scrollToSection('recent-patients')}>
              <div className="dd-stat-icon-wrap patients">👥</div>
              <div className="dd-stat-info">
                <span className="dd-stat-val">{loading ? '-' : stats.totalPatients}</span>
                <span className="dd-stat-label">Total Patients</span>
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
              <span className="dd-quick-icon">⏰</span>
              <span>Manage Availability</span>
            </button>

            <button
              id="doc-quick-view-appts-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => scrollToSection('today-appointments')}
            >
              <span className="dd-quick-icon">📋</span>
              <span>View Appointments</span>
            </button>

            <button
              id="doc-quick-edit-profile-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => navigate('/profile')}
            >
              <span className="dd-quick-icon">🩺</span>
              <span>Edit Profile</span>
            </button>

            <button
              id="doc-quick-view-patients-btn"
              type="button"
              className="dd-quick-btn"
              onClick={() => scrollToSection('recent-patients')}
            >
              <span className="dd-quick-icon">👤</span>
              <span>View Patients</span>
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
              <span className="dd-empty-icon">☕</span>
              <h3 className="dd-empty-title">No appointments scheduled for today</h3>
              <p className="dd-empty-desc">
                Patients who book slots for today will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="dd-appointments-grid">
              {todayAppointments.map((appt) => {
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

                      <span className={`dd-status-pill ${statusClass}`}>
                        ● {appt.status || 'Scheduled'}
                      </span>
                    </div>

                    <div className="dd-appt-details-row">
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Appointment Time</span>
                        <span className="dd-detail-val">⏰ {appt.timeSlot || '10:00 AM'}</span>
                      </div>
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Visit Format</span>
                        <span className="dd-detail-val">🩺 {appt.type || 'In-Person'}</span>
                      </div>
                    </div>

                    <div className="dd-appt-actions">
                      <button
                        type="button"
                        className="dd-btn-view-details"
                        onClick={() => setViewingAppt(appt)}
                      >
                        View Details
                      </button>

                      {!isCompleted && (
                        <button
                          type="button"
                          className="dd-btn-consult"
                          onClick={() => handleStartConsultation(appt)}
                        >
                          ▶ Start Consultation
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
              <span className="dd-empty-icon">📅</span>
              <h3 className="dd-empty-title">No upcoming appointments booked</h3>
              <p className="dd-empty-desc">
                Future reservations scheduled by patients will be displayed in this section.
              </p>
            </div>
          ) : (
            <div className="dd-appointments-grid">
              {upcomingAppointments.map((appt) => {
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

                      <span className={`dd-status-pill ${appt.status || 'scheduled'}`}>
                        ● {appt.status || 'Scheduled'}
                      </span>
                    </div>

                    <div className="dd-appt-details-row">
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Date & Time</span>
                        <span className="dd-detail-val">
                          📅 {formattedDate} • {appt.timeSlot || '10:00 AM'}
                        </span>
                      </div>
                      <div className="dd-detail-cell">
                        <span className="dd-detail-label">Type</span>
                        <span className="dd-detail-val">🩺 {appt.type || 'In-Person'}</span>
                      </div>
                    </div>

                    <div className="dd-appt-actions">
                      <button
                        type="button"
                        className="dd-btn-view-details"
                        style={{ width: '100%' }}
                        onClick={() => setViewingAppt(appt)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
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
            >
              ⚙ Manage Availability
            </button>
          </div>

          <div className="dd-avail-card">
            <div className="dd-avail-block">
              <span className="dd-avail-label">🗓 Working Days</span>
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
              <span className="dd-avail-label">⏰ Working Hours</span>
              <span className="dd-avail-hours-val">
                {availability.workingHours?.start || '09:00 AM'} -{' '}
                {availability.workingHours?.end || '05:00 PM'}
              </span>
            </div>

            <div className="dd-avail-block">
              <span className="dd-avail-label">⏱ Consultation Slots</span>
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
              <span className="dd-avail-label">🚫 Blocked Dates</span>
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
                  <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>
                    ✓ No blocked dates
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            6. RECENT PATIENTS & 8. NOTIFICATIONS (Split 2-Column Section)
            ======================================================== */}
        <div className="dd-split-grid">
          {/* 6. RECENT PATIENTS */}
          <section id="recent-patients" className="dd-section" aria-label="Recent Patients">
            <div className="dd-section-header">
              <div className="dd-section-title-wrap">
                <span className="dd-section-tag">Care History</span>
                <h2 className="dd-section-title">Recent Patients</h2>
              </div>
              <span className="dd-section-badge">{recentPatients.length} Patients</span>
            </div>

            <div className="dd-patients-card">
              {recentPatients.length === 0 ? (
                <div className="dd-empty-state">
                  <span className="dd-empty-icon">👥</span>
                  <h4 className="dd-empty-title">No patient visits recorded yet</h4>
                  <p className="dd-empty-desc">
                    Patients who book consultations with you will be listed here.
                  </p>
                </div>
              ) : (
                recentPatients.map((p) => (
                  <div key={p.patientId} className="dd-patient-item">
                    <div className="dd-patient-col">
                      <div className="dd-patient-avatar" style={{ width: '38px', height: '38px', fontSize: '0.88rem' }}>
                        {p.name.charAt(0).toUpperCase() || 'P'}
                      </div>
                      <div className="dd-patient-text">
                        <span className="dd-patient-name-text">{p.name}</span>
                        <span className="dd-patient-sub-text">
                          Last visit:{' '}
                          {new Date(p.lastAppointmentDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {p.totalVisits} appointment{p.totalVisits > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="dd-btn-view-patient"
                      onClick={() => handleViewPatientDetails(p.patientId)}
                    >
                      View Patient
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 8. NOTIFICATIONS */}
          <section id="notifications" className="dd-section" aria-label="Notifications">
            <div className="dd-section-header">
              <div className="dd-section-title-wrap">
                <span className="dd-section-tag">Alerts & Updates</span>
                <h2 className="dd-section-title">Notifications</h2>
              </div>
              <span className="dd-section-badge">
                {notifications.filter((n) => !n.isRead).length} New
              </span>
            </div>

            <div className="dd-notifications-card">
              {notifications.length === 0 ? (
                <div className="dd-empty-state">
                  <span className="dd-empty-icon">🔔</span>
                  <h4 className="dd-empty-title">No new notifications</h4>
                  <p className="dd-empty-desc">Appointment updates will appear here.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const icon =
                    n.type === 'cancellation'
                      ? '❌'
                      : n.type === 'rescheduled'
                      ? '🔄'
                      : n.type === 'system'
                      ? '⚙️'
                      : '📅'

                  return (
                    <div
                      key={n._id}
                      className={`dd-notif-item ${!n.isRead ? 'unread' : ''}`}
                      onClick={() => !n.isRead && handleMarkNotificationRead(n._id)}
                      title={!n.isRead ? 'Click to mark as read' : ''}
                      style={{ cursor: !n.isRead ? 'pointer' : 'default' }}
                    >
                      <span className="dd-notif-icon">{icon}</span>
                      <div className="dd-notif-content">
                        <h4 className="dd-notif-title">{n.title}</h4>
                        <p className="dd-notif-msg">{n.message}</p>
                        <span className="dd-notif-time">
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
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
              >
                ✕
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
              {/* Online/Offline status toggle */}
              <div className="dd-form-group">
                <label className="dd-form-label">Accepting New Patient Bookings</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`dd-day-toggle ${availForm.available ? 'selected' : ''}`}
                    onClick={() => setAvailForm((prev) => ({ ...prev, available: true }))}
                  >
                    ● Available Online
                  </button>
                  <button
                    type="button"
                    className={`dd-day-toggle ${!availForm.available ? 'selected' : ''}`}
                    onClick={() => setAvailForm((prev) => ({ ...prev, available: false }))}
                  >
                    ● Pause Bookings
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
                      {slot} ✕
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
                        style={{ background: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}
                        onClick={() => handleRemoveBlockedDate(date)}
                        title="Click to remove"
                      >
                        {date} ✕
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
              >
                ✕
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
                  {consultSubmitting ? 'Finalizing...' : '✓ Complete Consultation'}
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
              >
                ✕
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
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Format</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {viewingAppt.type || 'In-Person'}
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
            </div>
          </div>
        </div>
      )}

      {/* 6. PROTECTED PATIENT DETAILS MODAL (Requires View Patient action) */}
      {(patientModalLoading || selectedPatient) && (
        <div
          className="dd-modal-overlay"
          onClick={() => {
            setSelectedPatient(null)
            setPatientModalLoading(false)
          }}
        >
          <div className="dd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-header">
              <div>
                <span className="dd-section-tag">Protected Patient Profile</span>
                <h3 className="dd-modal-title">
                  {patientModalLoading ? 'Loading Details...' : selectedPatient?.name}
                </h3>
              </div>
              <button
                type="button"
                className="dd-btn-close"
                onClick={() => {
                  setSelectedPatient(null)
                  setPatientModalLoading(false)
                }}
              >
                ✕
              </button>
            </div>

            {patientModalLoading ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Fetching patient information...</p>
            ) : selectedPatient ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Email</span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{selectedPatient.email || 'N/A'}</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Phone</span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{selectedPatient.phone || 'Not provided'}</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Gender</span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'capitalize' }}>
                      {selectedPatient.gender || 'Not specified'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Blood Group</span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      {selectedPatient.bloodGroup || 'Not specified'}
                    </div>
                  </div>
                </div>

                {/* Consultation History with this Doctor */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1b2430', marginBottom: '8px' }}>
                    Consultation History With You ({patientAppointments.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {patientAppointments.map((pa) => (
                      <div
                        key={pa._id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          fontSize: '0.82rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong>
                            {pa.appointmentDate ? new Date(pa.appointmentDate).toLocaleDateString() : 'Recent'}
                          </strong>{' '}
                          • {pa.timeSlot}
                        </div>
                        <span className={`dd-status-pill ${pa.status || 'scheduled'}`}>
                          {pa.status || 'Scheduled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorDashboardPage
