import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMyPatientProfile,
  getSpecializations,
  getAvailableDoctors,
  getHospitals,
  getMyAppointments,
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
      setDoctors(res.doctors || [])
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

  // Handle Book Appointment
  const handleOpenBooking = (doc: DoctorProfile) => {
    setBookingDoctor(doc)
    // Default to tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setBookingDate(tomorrow.toISOString().split('T')[0])
    setBookingTime('10:00 AM')
    setBookingReason('')
    setBookingFeedback(null)
  }

  const handleCloseBooking = () => {
    setBookingDoctor(null)
    setBookingFeedback(null)
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

      setTimeout(() => {
        handleCloseBooking()
      }, 1500)
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Booking failed. Please try again.',
      })
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
                        <span className="php-doc-spec-badge">
                          {getSpecIcon(spec)} {spec}
                        </span>
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

            <form className="php-modal-form" onSubmit={handleConfirmBooking}>
              <div className="php-form-group">
                <label className="php-form-label">Appointment Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="php-form-input"
                />
              </div>

              <div className="php-form-group">
                <label className="php-form-label">Preferred Time Slot</label>
                <div className="php-time-grid">
                  {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`php-time-btn ${bookingTime === time ? 'active' : ''}`}
                      onClick={() => setBookingTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="php-form-group">
                <label className="php-form-label">Reason for Visit (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="E.g., Routine checkup, follow-up, consultation..."
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  className="php-form-textarea"
                />
              </div>

              <button
                type="submit"
                className="php-btn-submit"
                disabled={bookingSubmitting || !bookingDate}
              >
                {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
              </button>
            </form>
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
