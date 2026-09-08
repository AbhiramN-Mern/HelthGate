import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMyPatientProfile,
  getSpecializations,
  getAvailableDoctors,
  getHospitals,
  getMyAppointments,
  getDoctorBookedSlotsApi,
  type AuthUser,
  type PatientProfile,
  type DoctorProfile,
  type Hospital,
  type AppointmentItem,
} from '../../api/auth.api'
import './PatientHomePage.css'

type PatientHomePageProps = {
  user?: AuthUser | null
  onLogout: () => void
  onRequireAuth: () => void
}

const SPEC_ICON_MAP: Record<string, string> = {
  cardiology: '❤️',
  neurology: '🧠',
  pediatrics: '👶',
  orthopedics: '🦴',
  dermatology: '🧴',
  general: '🩺',
  oncology: '🎗️',
  psychiatry: '🧘',
  radiology: '🩻',
  dentistry: '🦷',
  ophthalmology: '👁️',
  ent: '👂',
  gynecology: '🌸',
}

const getSpecIcon = (specName: string): string => {
  const key = specName.toLowerCase().trim()
  for (const [k, icon] of Object.entries(SPEC_ICON_MAP)) {
    if (key.includes(k)) return icon
  }
  return '🩺'
}

function PatientHomePage({ user, onLogout, onRequireAuth }: PatientHomePageProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  // Backend Profile State
  const [profile, setProfile] = useState<PatientProfile | null>(null)

  // Real Database Data States (NO fallback dummy arrays!)
  const [specializations, setSpecializations] = useState<string[]>([])
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])

  // Loading States
  const [loadingSpecs, setLoadingSpecs] = useState(true)
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingHospitals, setLoadingHospitals] = useState(true)

  // Error States
  const [doctorsError, setDoctorsError] = useState<string | null>(null)

  // Search & Filter States
  const [searchInput, setSearchInput] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('')
  const [selectedHospital, setSelectedHospital] = useState('')

  // Booking Modal State
  const [bookingDoctor, setBookingDoctor] = useState<DoctorProfile | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('10:00 AM')
  const [bookingReason, setBookingReason] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingFeedback, setBookingFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [calMonth, setCalMonth] = useState<Date>(new Date())
  const [bookedSlotsByDate, setBookedSlotsByDate] = useState<Record<string, string[]>>({})

  // Fetch doctor's booked slots whenever bookingDoctor or calMonth changes
  useEffect(() => {
    if (!bookingDoctor?._id || !token) {
      setBookedSlotsByDate({})
      return
    }

    const year = calMonth.getFullYear()
    const month = String(calMonth.getMonth() + 1).padStart(2, '0')
    const monthStr = `${year}-${month}`

    let isMounted = true
    getDoctorBookedSlotsApi(bookingDoctor._id, { month: monthStr }, token)
      .then((data) => {
        if (isMounted && data.bookedSlotsByDate) {
          setBookedSlotsByDate(data.bookedSlotsByDate)
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch doctor booked slots:', err)
      })

    return () => {
      isMounted = false
    }
  }, [bookingDoctor, calMonth, token])

  // 1. Initial Load: Check Auth & Fetch Data
  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }

    // Fetch user profile from backend
    fetchProfile()

    // Fetch specializations from backend
    fetchSpecializations()

    // Fetch hospitals from backend
    fetchHospitals()

    // Fetch patient's actual appointments from backend
    fetchAppointments()
  }, [token])

  // 2. Fetch Doctors on filter changes
  useEffect(() => {
    if (token) {
      fetchDoctors()
    }
  }, [token, selectedSpec, selectedHospital])

  // API Call Handlers
  const fetchProfile = async () => {
    try {
      const res = await getMyPatientProfile(token)
      if (res.patient) {
        setProfile(res.patient)
      }
    } catch (err) {
      console.warn('Unable to load backend profile:', err)
    }
  }

  const fetchSpecializations = async () => {
    setLoadingSpecs(true)
    try {
      const res = await getSpecializations()
      setSpecializations(res.specializations || [])
    } catch (err) {
      console.warn('Failed to load specializations:', err)
    } finally {
      setLoadingSpecs(false)
    }
  }

  const fetchHospitals = async () => {
    setLoadingHospitals(true)
    try {
      const res = await getHospitals(token)
      setHospitals(res.hospitals || [])
    } catch (err) {
      console.warn('Failed to load hospitals:', err)
    } finally {
      setLoadingHospitals(false)
    }
  }

  const fetchAppointments = async () => {
    try {
      const res = await getMyAppointments(token)
      setAppointments(res.appointments || [])
    } catch (err) {
      console.warn('Failed to load appointments:', err)
    }
  }

  const fetchDoctors = async (overrideSearch?: string) => {
    setLoadingDoctors(true)
    setDoctorsError(null)
    try {
      const searchVal = overrideSearch !== undefined ? overrideSearch : searchInput
      const res = await getAvailableDoctors(
        {
          search: searchVal.trim() || undefined,
          specialization: selectedSpec || undefined,
          hospital: selectedHospital || undefined,
        },
        token,
      )
      const verifiedOnly = (res.doctors || []).filter(
        (doc) => doc.verificationStatus === 'verified'
      )
      setDoctors(verifiedOnly)
    } catch (err) {
      setDoctorsError(err instanceof Error ? err.message : 'Unable to load doctors from server.')
    } finally {
      setLoadingDoctors(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchDoctors(searchInput)
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSelectedSpec('')
    setSelectedHospital('')
    fetchDoctors('')
  }

  // Calendar & Availability Helpers
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const isSlotPast = (slotTime: string, selectedDateStr: string): boolean => {
    if (!selectedDateStr) return false
    const now = new Date()
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    if (selectedDateStr < todayDateStr) return true
    if (selectedDateStr > todayDateStr) return false

    const match = slotTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return false
    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const meridian = match[3]?.toUpperCase()
    if (meridian === 'PM' && hours < 12) hours += 12
    else if (meridian === 'AM' && hours === 12) hours = 0

    const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0)
    return slotDate.getTime() <= now.getTime()
  }

  const handleOpenBooking = (doc: DoctorProfile) => {
    setBookingDoctor(doc)
    setCalMonth(new Date())

    const blockedList = doc.availability?.blockedDates || []
    const workDays = doc.availability?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const slots = doc.availability?.availableSlots || ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM']

    // Find first available date (today or future) with at least one active future slot
    const candidate = new Date()
    let selectedDate = ''
    let selectedSlot = slots[0] || '10:00 AM'

    for (let i = 0; i < 30; i++) {
      const dStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`
      const dayName = WEEKDAYS[candidate.getDay()]
      if (!blockedList.includes(dStr) && workDays.includes(dayName)) {
        const freeSlot = slots.find((s) => !isSlotPast(s, dStr))
        if (freeSlot) {
          selectedDate = dStr
          selectedSlot = freeSlot
          break
        }
      }
      candidate.setDate(candidate.getDate() + 1)
    }

    if (!selectedDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      selectedDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    }

    setBookingDate(selectedDate)
    setBookingTime(selectedSlot)
    setBookingReason('')
    setBookingFeedback(null)
  }

  const handleCloseBooking = () => {
    setBookingDoctor(null)
    setBookingFeedback(null)
  }

  const handlePrevMonth = () => {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
  }

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingDoctor?._id || !bookingDate) return

    setBookingSubmitting(true)
    setBookingFeedback(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor: bookingDoctor._id,
          hospital: bookingDoctor.hospital?._id || undefined,
          appointmentDate: bookingDate,
          timeSlot: bookingTime,
          reason: bookingReason.trim() || 'General Consultation',
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to book appointment')
      }

      setBookingFeedback({ type: 'success', text: 'Appointment booked successfully!' })
      // Re-fetch patient's appointments immediately so upcoming appointments section appears!
      await fetchAppointments()

      // Also refresh doctor's booked slots immediately
      if (bookingDoctor?._id && token) {
        const year = calMonth.getFullYear()
        const month = String(calMonth.getMonth() + 1).padStart(2, '0')
        getDoctorBookedSlotsApi(bookingDoctor._id, { month: `${year}-${month}` }, token).then((res) => {
          if (res.bookedSlotsByDate) setBookedSlotsByDate(res.bookedSlotsByDate)
        }).catch(() => {})
      }

      setTimeout(() => {
        handleCloseBooking()
      }, 1500)
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Booking failed. Please try again.',
      })

      // In case of conflict, refresh booked slots so patient sees latest blocked slots
      if (bookingDoctor?._id && token) {
        const year = calMonth.getFullYear()
        const month = String(calMonth.getMonth() + 1).padStart(2, '0')
        getDoctorBookedSlotsApi(bookingDoctor._id, { month: `${year}-${month}` }, token).then((res) => {
          if (res.bookedSlotsByDate) setBookedSlotsByDate(res.bookedSlotsByDate)
        }).catch(() => {})
      }
    } finally {
      setBookingSubmitting(false)
    }
  }

  // Patient Display Name from Backend Profile or Auth State
  const patientDisplayName = profile?.user?.name || user?.name || 'Patient'
  const patientInitials = patientDisplayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Active Filter Count
  const hasActiveFilters = Boolean(searchInput.trim() || selectedSpec || selectedHospital)

  return (
    <div className="php-root">
      {/* ========================================================
          1. NAVBAR (User Profile Data from Backend & Logout)
          ======================================================== */}
      <nav className="php-navbar" aria-label="Patient navigation">
        <div className="php-navbar-inner">
          {/* Brand */}
          <div className="php-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="php-brand-logo">HG</div>
            <div className="php-brand-text">
              <span className="php-brand-name">HealthGate</span>
              <span className="php-brand-tag">Patient Portal</span>
            </div>
          </div>

          {/* Quick Section Links */}
          <ul className="php-nav-links">
            <li>
              <a href="#welcome" className="php-nav-link active">Home</a>
            </li>
            {appointments.length > 0 && (
              <li>
                <a href="#appointments" className="php-nav-link">
                  My Appointments ({appointments.length})
                </a>
              </li>
            )}
            <li>
              <a href="#specializations" className="php-nav-link">Specializations</a>
            </li>
            <li>
              <a href="#doctors" className="php-nav-link">Find Doctors</a>
            </li>
            <li>
              <a href="#hospitals" className="php-nav-link">Hospitals</a>
            </li>
          </ul>

          {/* User Profile & Logout */}
          <div className="php-nav-user">
            <div
              className="php-user-badge-wrap"
              onClick={() => navigate('/profile')}
              title="Click to view & edit profile"
            >
              {profile?.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={patientDisplayName}
                  className="php-user-avatar"
                />
              ) : (
                <div className="php-user-avatar">{patientInitials || 'P'}</div>
              )}
              <div className="php-user-info">
                <span className="php-user-name">{patientDisplayName}</span>
                <span className="php-user-role">
                  {profile?.bloodGroup ? `${profile.bloodGroup} • Patient` : 'Verified Patient'}
                </span>
              </div>
            </div>

            <button
              id="patient-nav-profile-btn"
              type="button"
              className="php-btn-profile"
              onClick={() => navigate('/profile')}
            >
              My Profile
            </button>

            <button
              id="patient-nav-logout-btn"
              type="button"
              className="php-btn-logout"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================
          2. & 3. WELCOME SECTION & SEARCH
          ======================================================== */}
      <header id="welcome" className="php-hero">
        <div className="php-hero-inner">
          <div className="php-hero-top">
            <div>
              <div className="php-hero-pill">
                <span className="php-hero-pill-dot" />
                Live Health Network
              </div>

              <p className="php-hero-greeting">
                Welcome back, <strong>{patientDisplayName}</strong> 👋
              </p>

              <h1 className="php-hero-title">
                Your Health,<br />
                <span>Our Gateway.</span>
              </h1>

              <p className="php-hero-sub">
                Connect with verified medical specialists, explore accredited hospitals,
                and manage your consultations through HealthGate's trusted gateway.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="php-hero-metrics">
              <div className="php-metric-card">
                <div className="php-metric-icon">🩺</div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{doctors.length}</span>
                  <span className="php-metric-label">Doctors Ready</span>
                </div>
              </div>
              <div className="php-metric-card">
                <div className="php-metric-icon">🏥</div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{hospitals.length}</span>
                  <span className="php-metric-label">Hospitals</span>
                </div>
              </div>
              <div className="php-metric-card">
                <div className="php-metric-icon">❤️</div>
                <div className="php-metric-info">
                  <span className="php-metric-value">{specializations.length}</span>
                  <span className="php-metric-label">Specialties</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. SEARCH BAR (Doctors / Specializations / Hospitals) */}
          <form className="php-search-box" onSubmit={handleSearchSubmit}>
            <div className="php-input-wrap">
              <span className="php-input-icon">🔍</span>
              <input
                id="patient-search-input"
                type="text"
                className="php-search-input"
                placeholder="Search doctors, specializations, or hospitals..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Specialization Select */}
            <div className="php-select-wrap">
              <select
                id="patient-spec-select"
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                aria-label="Filter by specialization"
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Hospital Select */}
            <div className="php-select-wrap">
              <select
                id="patient-hospital-select"
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                aria-label="Filter by hospital"
              >
                <option value="">All Hospitals</option>
                {hospitals.map((hosp) => (
                  <option key={hosp._id || hosp.name} value={hosp._id || hosp.name}>
                    {hosp.name}
                  </option>
                ))}
              </select>
            </div>

            <button id="patient-search-submit-btn" type="submit" className="php-btn-search">
              Search Doctors
            </button>

            {hasActiveFilters && (
              <button
                id="patient-search-reset-btn"
                type="button"
                className="php-btn-reset"
                onClick={handleResetFilters}
              >
                Clear
              </button>
            )}
          </form>

          {/* Active Filter Pills */}
          {hasActiveFilters && (
            <div className="php-filter-pills">
              <span className="php-filter-pill-label">Active Filters:</span>
              {searchInput.trim() && (
                <span className="php-filter-pill">
                  "{searchInput}"
                  <button type="button" onClick={() => { setSearchInput(''); fetchDoctors(''); }}>✕</button>
                </span>
              )}
              {selectedSpec && (
                <span className="php-filter-pill">
                  Specialty: {selectedSpec}
                  <button type="button" onClick={() => setSelectedSpec('')}>✕</button>
                </span>
              )}
              {selectedHospital && (
                <span className="php-filter-pill">
                  Hospital: {hospitals.find((h) => h._id === selectedHospital)?.name || 'Filtered'}
                  <button type="button" onClick={() => setSelectedHospital('')}>✕</button>
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ========================================================
          MAIN CONTENT
          ======================================================== */}
      <main className="php-main">
        {/* ========================================================
            7. UPCOMING APPOINTMENTS
            (Show section ONLY when appointments exist from GET /api/appointments/my)
            ======================================================== */}
        {appointments.length > 0 && (
          <section id="appointments" className="php-appointments-section" aria-label="My Appointments">
            <div className="php-section-header" style={{ marginBottom: '20px' }}>
              <div className="php-section-title-wrap">
                <span className="php-section-tag">Your Schedule</span>
                <h2 className="php-section-title">Upcoming Appointments</h2>
                <p className="php-section-desc">
                  Here are your scheduled appointments verified with your healthcare providers.
                </p>
              </div>
              <span className="php-section-count">{appointments.length} Scheduled</span>
            </div>

            <div className="php-appointments-grid">
              {appointments.map((appt) => {
                const docName = appt.doctor?.user?.name || 'Doctor'
                const docSpec = appt.doctor?.specialization || 'Specialist'
                const hospName = appt.hospital?.name || appt.doctor?.hospital?.name || 'Hospital Clinic'
                const formattedDate = appt.appointmentDate
                  ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Upcoming'

                return (
                  <div key={appt._id} className="php-appointment-card">
                    <div className="php-appt-header">
                      <span className="php-appt-status-badge">
                        ● {appt.status || 'Confirmed'}
                      </span>
                      <span className="php-appt-time-badge">
                        {appt.timeSlot || '10:00 AM'}
                      </span>
                    </div>

                    <div className="php-appt-doctor">
                      <div className="php-appt-avatar">
                        {docName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                      </div>
                      <div className="php-appt-doc-info">
                        <h3 className="php-appt-doc-name">{docName}</h3>
                        <span className="php-appt-doc-spec">{docSpec}</span>
                      </div>
                    </div>

                    <div className="php-appt-details">
                      <div className="php-appt-detail-row">
                        <span>📅</span>
                        <span>{formattedDate}</span>
                      </div>
                      <div className="php-appt-detail-row">
                        <span>🏥</span>
                        <span>{hospName}</span>
                      </div>
                      {appt.type && (
                        <div className="php-appt-detail-row">
                          <span>🩺</span>
                          <span>{appt.type} Visit</span>
                        </div>
                      )}
                    </div>

                    {appt.reason && (
                      <p className="php-appt-reason">
                        "{appt.reason}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ========================================================
            4. SPECIALIZATIONS (Only what exists from backend GET /api/specializations)
            ======================================================== */}
        <section id="specializations" className="php-section" aria-label="Medical Specializations">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Explore Specialties</span>
              <h2 className="php-section-title">Medical Specializations</h2>
              <p className="php-section-desc">
                Browse specializations currently available in the HealthGate network.
              </p>
            </div>
            {!loadingSpecs && specializations.length > 0 && (
              <span className="php-section-count">{specializations.length} Available</span>
            )}
          </div>

          {/* Loading Skeleton */}
          {loadingSpecs ? (
            <div className="php-specs-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '86px' }}>
                  <div className="php-skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '70%', height: '18px' }} />
                </div>
              ))}
            </div>
          ) : specializations.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon">🩺</span>
              <h3 className="php-empty-title">No specializations available</h3>
              <p className="php-empty-desc">
                No active doctor specializations found in the database. Registered specialties will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="php-specs-grid">
              {specializations.map((spec) => {
                const isActive = selectedSpec.toLowerCase() === spec.toLowerCase()
                return (
                  <div
                    key={spec}
                    className={`php-spec-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      // Toggle selection
                      setSelectedSpec(isActive ? '' : spec)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedSpec(isActive ? '' : spec)}
                  >
                    <div className="php-spec-icon-box">
                      {getSpecIcon(spec)}
                    </div>
                    <div className="php-spec-info">
                      <h3 className="php-spec-name">{spec}</h3>
                      <span className="php-spec-sub">
                        {isActive ? '✓ Active Filter' : 'Click to filter'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ========================================================
            5. DOCTORS (Registered doctors from GET /api/doctors)
            ======================================================== */}
        <section id="doctors" className="php-section" aria-label="Available Doctors">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Medical Experts</span>
              <h2 className="php-section-title">Registered Doctors</h2>
              <p className="php-section-desc">
                Verified practitioners with credentials, specializations, and affiliated hospitals.
              </p>
            </div>
            {!loadingDoctors && doctors.length > 0 && (
              <span className="php-section-count">{doctors.length} Doctors</span>
            )}
          </div>

          {/* Error Banner */}
          {doctorsError && (
            <div className="php-error-banner">
              <span>⚠️ {doctorsError}</span>
              <button
                type="button"
                className="php-btn-retry"
                onClick={() => fetchDoctors()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loadingDoctors ? (
            <div className="php-doctors-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '240px' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="php-skeleton" style={{ width: '64px', height: '64px', borderRadius: '18px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="php-skeleton" style={{ width: '60%', height: '20px' }} />
                      <div className="php-skeleton" style={{ width: '40%', height: '16px' }} />
                    </div>
                  </div>
                  <div className="php-skeleton" style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '100%', height: '38px', borderRadius: '12px', marginTop: 'auto' }} />
                </div>
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon">👨‍⚕️</span>
              <h3 className="php-empty-title">No doctors available</h3>
              <p className="php-empty-desc">
                {hasActiveFilters
                  ? 'No doctors match your current search filters. Try clearing filters or searching for another term.'
                  : 'There are currently no registered doctors in the database. When doctors join HealthGate, they will appear here.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="php-btn-reset"
                  style={{ marginTop: '8px' }}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="php-doctors-grid">
              {doctors.map((doc) => {
                const docName = doc.user?.name || 'Medical Doctor'
                const initials = docName
                  .replace(/^Dr\.?\s*/i, '')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
                const spec = doc.specialization || 'General Practitioner'
                const hospName = doc.hospital?.name || 'Independent Practice'
                const fee = doc.consultationFee ? `₹${doc.consultationFee}` : 'Free / Inquire'
                const exp = doc.experienceYears ? `${doc.experienceYears} Years` : 'Experienced'

                return (
                  <div key={doc._id} className="php-doctor-card">
                    <div className="php-doc-top">
                      <div className="php-doc-avatar-wrap">
                        {doc.profileImage ? (
                          <img
                            src={doc.profileImage}
                            alt={docName}
                            className="php-doc-avatar"
                          />
                        ) : (
                          <div className="php-doc-avatar">{initials || 'DR'}</div>
                        )}
                        <span
                          className="php-doc-status-indicator"
                          title={doc.available ? 'Available' : 'Unavailable'}
                          style={{ background: doc.available ? '#10b981' : '#94a3b8' }}
                        />
                      </div>

                      <div className="php-doc-main-info">
                        <h3 className="php-doc-name">{docName}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="php-doc-spec-badge">
                            {getSpecIcon(spec)} {spec}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#065f46',
                              background: '#d1fae5',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            ✓ Verified
                          </span>
                        </div>
                        <div className="php-doc-hospital-tag">
                          <span>🏥</span>
                          <span>{hospName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="php-doc-meta-grid">
                      <div className="php-doc-meta-item">
                        <span className="php-doc-meta-label">Experience</span>
                        <span className="php-doc-meta-val">{exp}</span>
                      </div>
                      <div className="php-doc-meta-item">
                        <span className="php-doc-meta-label">Consultation</span>
                        <span className="php-doc-meta-val">{fee}</span>
                      </div>
                    </div>

                    <div className="php-doc-actions">
                      <button
                        type="button"
                        className="php-btn-book"
                        onClick={() => handleOpenBooking(doc)}
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ========================================================
            6. HOSPITALS (Created by admins from GET /api/hospitals)
            ======================================================== */}
        <section id="hospitals" className="php-section" aria-label="Partner Hospitals">
          <div className="php-section-header">
            <div className="php-section-title-wrap">
              <span className="php-section-tag">Accredited Network</span>
              <h2 className="php-section-title">Hospitals & Centers</h2>
              <p className="php-section-desc">
                Healthcare institutions registered and approved by HealthGate administration.
              </p>
            </div>
            {!loadingHospitals && hospitals.length > 0 && (
              <span className="php-section-count">{hospitals.length} Hospitals</span>
            )}
          </div>

          {/* Loading Skeleton */}
          {loadingHospitals ? (
            <div className="php-hospitals-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="php-skeleton-card" style={{ height: '130px' }}>
                  <div className="php-skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                  <div className="php-skeleton" style={{ width: '80%', height: '20px' }} />
                </div>
              ))}
            </div>
          ) : hospitals.length === 0 ? (
            <div className="php-empty-card">
              <span className="php-empty-icon">🏥</span>
              <h3 className="php-empty-title">No hospitals available</h3>
              <p className="php-empty-desc">
                No hospitals have been registered in the system yet. Hospital partners created by administrators will be displayed here.
              </p>
            </div>
          ) : (
            <div className="php-hospitals-grid">
              {hospitals.map((hosp) => {
                const isActiveFilter = selectedHospital === hosp._id
                return (
                  <div
                    key={hosp._id || hosp.name}
                    className={`php-hospital-card ${isActiveFilter ? 'active' : ''}`}
                    onClick={() => {
                      // Toggle hospital filter
                      const newFilter = isActiveFilter ? '' : hosp._id || ''
                      setSelectedHospital(newFilter)
                      // Smooth scroll down to doctors section
                      document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSelectedHospital(isActiveFilter ? '' : hosp._id || '')
                      }
                    }}
                  >
                    <div className="php-hosp-icon-wrap">🏥</div>
                    <div>
                      <h3 className="php-hosp-name">{hosp.name}</h3>
                      <span className={`php-hosp-badge ${hosp.isActive !== false ? 'active' : 'inactive'}`}>
                        ● {hosp.isActive !== false ? 'Active Network' : 'Affiliate'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* ========================================================
          BOOK APPOINTMENT MODAL
          ======================================================== */}
      {bookingDoctor && (
        <div className="php-modal-overlay" onClick={handleCloseBooking}>
          <div className="php-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="php-modal-header">
              <div>
                <span className="php-section-tag">Schedule Consultation</span>
                <h2 className="php-modal-title">Book with {bookingDoctor.user?.name || 'Doctor'}</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>
                  {bookingDoctor.specialization} • {bookingDoctor.hospital?.name || 'Clinic'}
                </p>
              </div>
              <button
                type="button"
                className="php-btn-close"
                onClick={handleCloseBooking}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {bookingFeedback && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: bookingFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: bookingFeedback.type === 'success' ? '#065f46' : '#991b1b',
                  border: `1px solid ${bookingFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                }}
              >
                {bookingFeedback.text}
              </div>
            )}

            {/* Modal Body / Form */}
            {(() => {
              const year = calMonth.getFullYear()
              const month = calMonth.getMonth()
              const monthName = calMonth.toLocaleString('default', { month: 'long' })
              const firstDayIndex = new Date(year, month, 1).getDay()
              const totalDays = new Date(year, month + 1, 0).getDate()

              const now = new Date()
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

              const blockedDates = bookingDoctor.availability?.blockedDates || []
              const workDays = bookingDoctor.availability?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
              const availableSlots = bookingDoctor.availability?.availableSlots?.length
                ? bookingDoctor.availability.availableSlots
                : ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM']

              const currentDayBookedSlots = (bookingDate && bookedSlotsByDate[bookingDate]) || []
              const isSelectedSlotBooked = Boolean(bookingTime && currentDayBookedSlots.includes(bookingTime))
              const isSelectedSlotPast = Boolean(bookingTime && isSlotPast(bookingTime, bookingDate))

              const availableSlotsCount = availableSlots.filter(
                (s) => !currentDayBookedSlots.includes(s) && !isSlotPast(s, bookingDate)
              ).length
              const allSlotsUnavailableOnDate = availableSlotsCount === 0

              const isDateBlocked = (dateStr: string) => blockedDates.includes(dateStr)
              const isDateOffDuty = (dayIdx: number) => !workDays.includes(WEEKDAYS[dayIdx])

              const isSelectedDateBlocked = Boolean(bookingDate && isDateBlocked(bookingDate))
              const isSelectedDateOffDuty = Boolean(
                bookingDate && isDateOffDuty(new Date(bookingDate).getDay())
              )
              const isSelectedDatePast = Boolean(bookingDate && bookingDate < todayStr)
              const isBookingDisabled =
                bookingSubmitting ||
                !bookingDate ||
                !bookingTime ||
                isSelectedDateBlocked ||
                isSelectedDateOffDuty ||
                isSelectedDatePast ||
                allSlotsUnavailableOnDate ||
                isSelectedSlotBooked ||
                isSelectedSlotPast

              return (
                <form className="php-modal-form" onSubmit={handleConfirmBooking}>
                  {/* Visual Calendar */}
                  <div className="php-form-group">
                    <label className="php-form-label">
                      Select Date (Doctor's Schedule)
                    </label>

                    <div className="php-calendar-box">
                      {/* Month & Navigation Header */}
                      <div className="php-cal-header">
                        <button
                          type="button"
                          className="php-cal-nav-btn"
                          onClick={handlePrevMonth}
                          title="Previous Month"
                        >
                          ‹
                        </button>
                        <span className="php-cal-month-title">
                          {monthName} {year}
                        </span>
                        <button
                          type="button"
                          className="php-cal-nav-btn"
                          onClick={handleNextMonth}
                          title="Next Month"
                        >
                          ›
                        </button>
                      </div>

                      {/* Day-of-week Headers */}
                      <div className="php-cal-weekdays">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                          <span key={w}>{w}</span>
                        ))}
                      </div>

                      {/* Calendar Days Grid */}
                      <div className="php-cal-grid">
                        {/* Leading Empty Cells */}
                        {Array.from({ length: firstDayIndex }).map((_, i) => (
                          <div key={`empty-${i}`} className="php-cal-cell empty" />
                        ))}

                        {/* Month Days */}
                        {Array.from({ length: totalDays }).map((_, i) => {
                          const d = i + 1
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const dayDate = new Date(year, month, d)
                          const isPast = dateStr < todayStr
                          const isBlocked = isDateBlocked(dateStr)
                          const isOff = isDateOffDuty(dayDate.getDay())
                          const dayBookedSlots = bookedSlotsByDate[dateStr] || []
                          const dayOpenCount = availableSlots.filter(
                            (s) => !dayBookedSlots.includes(s) && !isSlotPast(s, dateStr)
                          ).length
                          const isDayNoSlots = dayOpenCount === 0
                          const isDayFull = isDayNoSlots && !isPast && !isBlocked && !isOff
                          const isSelected = bookingDate === dateStr
                          const isAvailable = !isPast && !isBlocked && !isOff && !isDayNoSlots

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              className={`php-cal-cell ${
                                isBlocked
                                  ? 'blocked'
                                  : isOff
                                  ? 'off-duty'
                                  : isPast
                                  ? 'past'
                                  : isDayFull
                                  ? 'full'
                                  : isSelected
                                  ? 'selected'
                                  : 'available'
                              }`}
                              disabled={!isAvailable}
                              onClick={() => {
                                setBookingDate(dateStr)
                                const dayTaken = bookedSlotsByDate[dateStr] || []
                                if (dayTaken.includes(bookingTime) || isSlotPast(bookingTime, dateStr)) {
                                  const nextFree = availableSlots.find(
                                    (s) => !dayTaken.includes(s) && !isSlotPast(s, dateStr)
                                  )
                                  if (nextFree) setBookingTime(nextFree)
                                }
                              }}
                              title={
                                isBlocked
                                  ? 'Blocked: Doctor is unavailable / on leave'
                                  : isOff
                                  ? 'Off-duty day for doctor'
                                  : isPast
                                  ? 'Past date'
                                  : isDayFull
                                  ? 'No Available Slots: All slots on this date are taken or have passed'
                                  : `Available: ${dateStr}`
                              }
                            >
                              <span>{d}</span>
                              {isBlocked && (
                                <span className="php-cal-blocked-tag">Blocked</span>
                              )}
                              {isOff && !isPast && !isBlocked && (
                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>Off</span>
                              )}
                              {isDayFull && !isPast && !isBlocked && !isOff && (
                                <span className="php-cal-full-tag">Full</span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Calendar Legend */}
                      <div className="php-cal-legend">
                        <span className="php-legend-item">
                          <span className="php-legend-dot avail" /> Available
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot block" /> Blocked / Leave
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot off" /> Off-duty
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot full" /> Fully Booked
                        </span>
                        <span className="php-legend-item">
                          <span className="php-legend-dot sel" /> Selected
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Blocked Dates List Banner (if any) */}
                  {blockedDates.length > 0 && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <strong>🚫 Blocked Dates by Doctor:</strong>
                      {blockedDates.map((bDate) => (
                        <span
                          key={bDate}
                          style={{
                            background: '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                          }}
                        >
                          {bDate}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Selected Date Status Banner */}
                  {isSelectedDateBlocked ? (
                    <div className="php-date-status-alert blocked">
                      <span>🚫</span>
                      <span>
                        Dr. {bookingDoctor.user?.name} is on leave / blocked on this date.
                        Appointment booking is disabled on this day. Please select an available green date.
                      </span>
                    </div>
                  ) : isSelectedDateOffDuty ? (
                    <div className="php-date-status-alert off">
                      <span>⚠️</span>
                      <span>
                        Doctor is off-duty on {WEEKDAYS[new Date(bookingDate).getDay()]}s.
                        Please select an available green day.
                      </span>
                    </div>
                  ) : bookingDate ? (
                    <div className="php-date-status-alert available">
                      <span>✅</span>
                      <span>
                        Selected Date:{' '}
                        <strong>
                          {new Date(bookingDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </strong>{' '}
                        (Available)
                      </span>
                    </div>
                  ) : null}

                  {/* Preferred Time Slot */}
                  <div className="php-form-group">
                    <div className="php-slots-header-row">
                      <label className="php-form-label" style={{ margin: 0 }}>
                        Available Time Slots ({availableSlotsCount} open)
                      </label>
                      <div className="php-slots-legend">
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot avail" style={{ width: '7px', height: '7px' }} /> Open
                        </span>
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot block" style={{ width: '7px', height: '7px' }} /> Booked
                        </span>
                        <span className="php-slots-legend-item">
                          <span className="php-legend-dot off" style={{ width: '7px', height: '7px' }} /> Past
                        </span>
                      </div>
                    </div>

                    <div className="php-time-grid">
                      {availableSlots.map((time) => {
                        const isSlotBooked = currentDayBookedSlots.includes(time)
                        const isPast = isSlotPast(time, bookingDate)
                        const isUnavailable = isSlotBooked || isPast

                        return (
                          <button
                            key={time}
                            type="button"
                            className={`php-time-btn ${bookingTime === time && !isUnavailable ? 'active' : ''} ${
                              isSlotBooked ? 'booked' : isPast ? 'past' : ''
                            }`}
                            onClick={() => {
                              if (!isUnavailable) setBookingTime(time)
                            }}
                            disabled={isBookingDisabled || isUnavailable}
                            title={
                              isPast
                                ? `Time slot ${time} has already passed`
                                : isSlotBooked
                                ? `Time slot ${time} is already booked by another patient`
                                : `Select ${time}`
                            }
                          >
                            <span>{time}</span>
                            {isSlotBooked && <span className="php-slot-booked-badge">Booked</span>}
                            {isPast && !isSlotBooked && <span className="php-slot-past-badge">Past</span>}
                          </button>
                        )
                      })}
                    </div>

                    {allSlotsUnavailableOnDate && (
                      <div className="php-date-status-alert blocked" style={{ marginTop: '10px' }}>
                        <span>⛔</span>
                        <span>
                          {bookingDate === todayStr
                            ? 'All consultation slots for today have already passed or been booked. Please select an upcoming date.'
                            : 'All consultation slots on this date are fully booked. Please select another date from the calendar.'}
                        </span>
                      </div>
                    )}

                    {isSelectedSlotPast && !allSlotsUnavailableOnDate && (
                      <div className="php-date-status-alert off" style={{ marginTop: '10px' }}>
                        <span>⏰</span>
                        <span>The slot "{bookingTime}" has already passed today. Please choose an upcoming open slot above.</span>
                      </div>
                    )}

                    {isSelectedSlotBooked && !allSlotsUnavailableOnDate && !isSelectedSlotPast && (
                      <div className="php-date-status-alert blocked" style={{ marginTop: '10px' }}>
                        <span>⚠️</span>
                        <span>The slot "{bookingTime}" has already been booked. Please pick an open slot above.</span>
                      </div>
                    )}
                  </div>

                  {/* Reason for Visit */}
                  <div className="php-form-group">
                    <label className="php-form-label">Reason for Visit (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="E.g., Routine checkup, consultation, symptoms..."
                      value={bookingReason}
                      onChange={(e) => setBookingReason(e.target.value)}
                      className="php-form-textarea"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="php-btn-submit"
                    disabled={isBookingDisabled}
                  >
                    {bookingSubmitting
                      ? 'Confirming...'
                      : isSelectedDateBlocked
                      ? 'Doctor Blocked on this Date'
                      : isSelectedDateOffDuty
                      ? 'Doctor Off-Duty'
                      : isSelectedDatePast
                      ? 'Date has passed'
                      : allSlotsUnavailableOnDate
                      ? 'No Available Slots'
                      : isSelectedSlotPast
                      ? 'Slot Has Passed'
                      : isSelectedSlotBooked
                      ? 'Selected Slot Already Booked'
                      : 'Confirm Appointment'}
                  </button>
                </form>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <footer className="php-footer">
        <div className="php-footer-inner">
          <div className="php-footer-brand">
            <div className="php-brand-logo" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>HG</div>
            <span>HealthGate Patient Gateway</span>
          </div>

          <div>
            <span>© 2026 HealthGate. Real-Time Connected Healthcare Portal.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PatientHomePage
