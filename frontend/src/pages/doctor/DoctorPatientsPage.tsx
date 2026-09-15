import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDoctorDashboard,
  getDoctorPatientDetailsApi,
  getFriendlyErrorMessage,
  type AuthUser,
  type DoctorProfile,
  type AppointmentItem,
} from '../../api/auth.api'
import './DoctorPages.css'
import {
  UsersIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  BellIcon,
} from '../../components/common/Icons'

type DoctorPatientsPageProps = {
  user?: AuthUser | null
  onLogout: () => void
  onRequireAuth: () => void
}

type PatientRecord = {
  patientId: string
  name: string
  email: string
  lastAppointmentDate: string
  lastAppointmentStatus: string
  appointmentType: string
  totalVisits: number
}

function DoctorPatientsPage({ user, onLogout, onRequireAuth }: DoctorPatientsPageProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  // Doctor profile & data
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [visitFilter, setVisitFilter] = useState<'all' | 'returning' | 'single'>('all')

  // Patient Details Modal State
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
  const [modalFeedback, setModalFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }
    fetchData()
  }, [token])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDoctorDashboard(token)
      if (data.doctor) setDoctor(data.doctor)
      if (data.recentPatients) setPatients(data.recentPatients)
      if (data.notifications) {
        setUnreadNotifCount(data.notifications.filter((n) => !n.isRead).length)
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to load patient records'))
    } finally {
      setLoading(false)
    }
  }

  const handleViewPatientDetails = async (patientId: string) => {
    setPatientModalLoading(true)
    setSelectedPatient(null)
    setPatientAppointments([])
    setModalFeedback(null)

    try {
      const data = await getDoctorPatientDetailsApi(patientId, token)
      if (data.patient) setSelectedPatient(data.patient)
      if (data.appointments) setPatientAppointments(data.appointments)
    } catch (err) {
      setModalFeedback(getFriendlyErrorMessage(err, 'Unable to load complete patient history.'))
    } finally {
      setPatientModalLoading(false)
    }
  }

  // Filtered Patients
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (visitFilter === 'returning') return p.totalVisits > 1
    if (visitFilter === 'single') return p.totalVisits === 1
    return true
  })

  const doctorName = doctor?.user?.name || user?.name || 'Doctor'
  const doctorSpecialization = doctor?.specialization || 'Medical Specialist'
  const totalVisitsCount = patients.reduce((acc, p) => acc + (p.totalVisits || 1), 0)

  return (
    <div className="dsub-root">
      {/* --------------------------------------------------------
          Header
          -------------------------------------------------------- */}
      <header className="dsub-header">
        <div className="dsub-header-inner">
          <div className="dsub-brand" onClick={() => navigate('/doctor/dashboard')}>
            <div className="dsub-brand-logo">HG</div>
            <div>
              <div className="dsub-brand-title">HealthGate</div>
              <div className="dsub-brand-tag">Physician Console</div>
            </div>
          </div>

          <nav className="dsub-nav-links">
            <button
              type="button"
              className="dsub-nav-btn"
              onClick={() => navigate('/doctor/dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className="dsub-nav-btn active"
              onClick={() => navigate('/doctor/patients')}
            >
              <UsersIcon size={16} />
              <span>Patients</span>
              <span className="dsub-badge-count">{patients.length}</span>
            </button>
            <button
              type="button"
              className="dsub-nav-btn"
              onClick={() => navigate('/doctor/notifications')}
            >
              <BellIcon size={16} />
              <span>Notifications</span>
              {unreadNotifCount > 0 && (
                <span className="dsub-badge-count unread">{unreadNotifCount}</span>
              )}
            </button>
          </nav>

          <div className="dsub-header-actions">
            <div className="dsub-doc-chip">
              {doctor?.profileImage ? (
                <img src={doctor.profileImage} alt={doctorName} className="dsub-doc-avatar" />
              ) : (
                <div className="dsub-doc-avatar">
                  {doctorName.replace(/^Dr\.?\s*/i, '').charAt(0) || 'D'}
                </div>
              )}
              <span className="dsub-doc-name">Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}</span>
            </div>

            <button
              type="button"
              className="dsub-btn-logout"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------
          Main Body
          -------------------------------------------------------- */}
      <main className="dsub-main">
        {/* Navigation Sub-bar */}
        <div className="dsub-subbar">
          <button
            type="button"
            className="dsub-back-link"
            onClick={() => navigate('/doctor/dashboard')}
          >
            ← Back to Dashboard
          </button>

          <div className="dsub-tab-switch">
            <button
              type="button"
              className="dsub-tab-pill active"
              onClick={() => navigate('/doctor/patients')}
            >
              <UsersIcon size={16} /> Recent Patients & Care History
            </button>
            <button
              type="button"
              className="dsub-tab-pill"
              onClick={() => navigate('/doctor/notifications')}
            >
              <BellIcon size={16} /> Alerts & Notifications
              {unreadNotifCount > 0 && (
                <span className="dsub-badge-count unread" style={{ marginLeft: 4 }}>
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="dsub-hero">
          <div>
            <span className="dsub-hero-tag">
              <UsersIcon size={13} /> Care History Directory
            </span>
            <h1 className="dsub-hero-title">Recent Patients & Care History</h1>
            <p className="dsub-hero-desc">
              Comprehensive clinical record of patients who have consulted with you. Review appointment frequency,
              latest consultation dates, and complete case profiles.
            </p>
          </div>

          <div className="dsub-hero-stats">
            <div className="dsub-hero-stat-card">
              <div className="dsub-hero-stat-val">{loading ? '-' : patients.length}</div>
              <div className="dsub-hero-stat-lbl">Total Patients</div>
            </div>
            <div className="dsub-hero-stat-card">
              <div className="dsub-hero-stat-val">{loading ? '-' : totalVisitsCount}</div>
              <div className="dsub-hero-stat-lbl">Total Visits Recorded</div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="dsub-filter-bar">
          <div className="dsub-search-wrap">
            <span className="dsub-search-icon">🔍</span>
            <input
              type="text"
              className="dsub-search-input"
              placeholder="Search patients by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="dsub-filter-chips">
            <button
              type="button"
              className={`dsub-chip ${visitFilter === 'all' ? 'active' : ''}`}
              onClick={() => setVisitFilter('all')}
            >
              All ({patients.length})
            </button>
            <button
              type="button"
              className={`dsub-chip ${visitFilter === 'returning' ? 'active' : ''}`}
              onClick={() => setVisitFilter('returning')}
            >
              Returning (&gt;1 Visit) ({patients.filter((p) => p.totalVisits > 1).length})
            </button>
            <button
              type="button"
              className={`dsub-chip ${visitFilter === 'single' ? 'active' : ''}`}
              onClick={() => setVisitFilter('single')}
            >
              First-Time ({patients.filter((p) => p.totalVisits === 1).length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="dsub-loading-wrap">
            <div className="dsub-spinner" />
            <p>Loading patient directory & care records...</p>
          </div>
        ) : error ? (
          <div className="dsub-empty-state" style={{ borderColor: '#fca5a5' }}>
            <span className="dsub-empty-icon" style={{ color: '#dc2626', background: '#fef2f2' }}>
              <AlertCircleIcon size={32} />
            </span>
            <h3 className="dsub-empty-title">Error Loading Patients</h3>
            <p className="dsub-empty-desc">{error}</p>
            <button
              type="button"
              className="dsub-btn-primary"
              onClick={fetchData}
              style={{ marginTop: 8 }}
            >
              Try Again
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="dsub-empty-state">
            <span className="dsub-empty-icon">
              <UsersIcon size={32} />
            </span>
            <h3 className="dsub-empty-title">No patient records found</h3>
            <p className="dsub-empty-desc">
              {searchQuery
                ? `No patients match "${searchQuery}". Try adjusting your search query.`
                : 'Patients who book consultations with you will appear here with complete care history.'}
            </p>
          </div>
        ) : (
          <div className="dsub-patients-grid">
            {filteredPatients.map((p) => (
              <div key={p.patientId} className="dsub-patient-card">
                <div>
                  <div className="dsub-patient-header">
                    <div className="dsub-patient-info">
                      <div className="dsub-patient-avatar-lg">
                        {p.name.charAt(0).toUpperCase() || 'P'}
                      </div>
                      <div>
                        <div className="dsub-patient-name">{p.name}</div>
                        <div className="dsub-patient-email">{p.email}</div>
                      </div>
                    </div>

                    <span className="dsub-patient-badge">
                      {p.totalVisits} visit{p.totalVisits > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="dsub-patient-meta" style={{ marginTop: '16px' }}>
                    <div>
                      <div className="dsub-meta-lbl">Last Consultation</div>
                      <div className="dsub-meta-val">
                        {p.lastAppointmentDate
                          ? new Date(p.lastAppointmentDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Recent'}
                      </div>
                    </div>
                    <div>
                      <div className="dsub-meta-lbl">Appointment Type</div>
                      <div className="dsub-meta-val" style={{ textTransform: 'capitalize' }}>
                        {p.appointmentType || 'In-Person'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dsub-card-actions">
                  <button
                    type="button"
                    className="dsub-btn-view"
                    onClick={() => handleViewPatientDetails(p.patientId)}
                  >
                    View Care Details & Records
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* --------------------------------------------------------
          Protected Patient Details Modal
          -------------------------------------------------------- */}
      {(patientModalLoading || selectedPatient) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            setSelectedPatient(null)
            setPatientModalLoading(false)
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#0d5c63',
                    letterSpacing: '0.5px',
                  }}
                >
                  Protected Patient Profile
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>
                  {patientModalLoading ? 'Loading Profile...' : selectedPatient?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null)
                  setPatientModalLoading(false)
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}
                aria-label="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {modalFeedback && (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                {modalFeedback}
              </div>
            )}

            {patientModalLoading ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b' }}>
                <div className="dsub-spinner" style={{ margin: '0 auto 12px' }} />
                <p>Retrieving secure patient records...</p>
              </div>
            ) : selectedPatient ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Demographics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Email Address
                    </span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginTop: '2px' }}>
                      {selectedPatient.email || 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Phone Number
                    </span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginTop: '2px' }}>
                      {selectedPatient.phone || 'Not provided'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Gender
                    </span>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: '#1e293b',
                        marginTop: '2px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {selectedPatient.gender || 'Not specified'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Blood Group
                    </span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginTop: '2px' }}>
                      {selectedPatient.bloodGroup || 'Not specified'}
                    </div>
                  </div>
                </div>

                {/* Consultation History with this Doctor */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Care History With You</span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#0d5c63',
                        background: '#e6f4f4',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      {patientAppointments.length} Record{patientAppointments.length === 1 ? '' : 's'}
                    </span>
                  </h4>

                  {patientAppointments.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.85rem',
                      }}
                    >
                      No past consultation records found for this doctor.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                      {patientAppointments.map((pa) => (
                        <div
                          key={pa._id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            fontSize: '0.84rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>
                              {pa.appointmentDate
                                ? new Date(pa.appointmentDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Recent'}{' '}
                              • {pa.timeSlot}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                              Format: {pa.consultationType === 'offline' ? '🏥 In-Person' : '📹 Online Video'}
                              {pa.reason && ` • "${pa.reason}"`}
                            </div>
                          </div>

                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              background:
                                pa.status === 'completed'
                                  ? '#ecfdf5'
                                  : pa.status === 'cancelled'
                                  ? '#fef2f2'
                                  : '#eff6ff',
                              color:
                                pa.status === 'completed'
                                  ? '#059669'
                                  : pa.status === 'cancelled'
                                  ? '#dc2626'
                                  : '#2563eb',
                            }}
                          >
                            {pa.status || 'Scheduled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorPatientsPage
