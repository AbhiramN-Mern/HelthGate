import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAllDoctorsForAdmin,
  getAllPatientsForAdmin,
  getDoctorByIdForAdmin,
  getPatientByIdForAdmin,
  rejectDoctorForAdmin,
  togglePatientStatusForAdmin,
  updateDoctorByIdForAdmin,
  updatePatientByIdForAdmin,
  verifyDoctorForAdmin,
  getAllHospitalsForAdmin,
  createHospitalForAdmin,
  updateHospitalByIdForAdmin,
  getAdminDashboardApi,
  getAllAppointmentsForAdminApi,
  getSpecializations,
  type AdminDoctor,
  type AdminPatient,
  type Hospital,
  type AppointmentItem,
  type AdminDashboardStats,
} from '../../api/auth.api'
import {
  DashboardIcon,
  UsersIcon,
  StethoscopeIcon,
  HospitalIcon,
  CalendarIcon,
  HeartPulseIcon,
  CreditCardIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  SearchIcon,
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
} from '../../components/common/Icons'
import './AdminDashboardPage.css'

type AdminDashboardPageProps = {
  user?: {
    name?: string
    email?: string
    role?: string
  } | null
  onLogout: () => void
  initialSection?: string
}

type NavSection =
  | 'dashboard'
  | 'patients'
  | 'doctors'
  | 'hospitals'
  | 'appointments'
  | 'specializations'
  | 'payments'
  | 'complaints'
  | 'reports'

type PatientFormState = {
  gender: string
  phone: string
  address: string
  bloodGroup: string
  allergies: string
  medicalHistory: string
  active: boolean
}

type DoctorFormState = {
  specialization: string
  qualification: string
  licenseNumber: string
  consultationFee: string
  experienceYears: string
  available: boolean
  verificationStatus: 'pending' | 'verified' | 'rejected'
}

type ComplaintItem = {
  id: string
  userName: string
  userRole: 'Patient' | 'Doctor'
  category: string
  severity: 'high' | 'medium' | 'low'
  status: 'Under Review' | 'Investigating' | 'Resolved'
  date: string
  message: string
}

const defaultPatientForm = (): PatientFormState => ({
  gender: 'male',
  phone: '',
  address: '',
  bloodGroup: 'A+',
  allergies: '',
  medicalHistory: '',
  active: true,
})

const defaultDoctorForm = (): DoctorFormState => ({
  specialization: '',
  qualification: '',
  licenseNumber: '',
  consultationFee: '0',
  experienceYears: '0',
  available: true,
  verificationStatus: 'pending',
})

const normalizeList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

function AdminDashboardPage({ user, onLogout, initialSection = 'dashboard' }: AdminDashboardPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const token = localStorage.getItem('helthgate_token') || ''

  // Navigation State
  const [activeSection, setActiveSection] = useState<NavSection>(
    (initialSection as NavSection) || 'dashboard'
  )

  // Loading & Global States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // 1. Dashboard Specific States
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalPatients: 0,
    totalDoctors: 0,
    totalHospitals: 0,
    totalAppointments: 0,
    pendingDoctorApprovals: 0,
    todayAppointments: 0,
  })
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [appointmentsOverview, setAppointmentsOverview] = useState<{
    daily: { label: string; date: string; count: number }[]
    weekly: { label: string; count: number }[]
    monthly: { label: string; count: number }[]
  }>({
    daily: [
      { label: 'Mon', date: '', count: 12 },
      { label: 'Tue', date: '', count: 18 },
      { label: 'Wed', date: '', count: 25 },
      { label: 'Thu', date: '', count: 20 },
      { label: 'Fri', date: '', count: 29 },
      { label: 'Sat', date: '', count: 14 },
      { label: 'Sun', date: '', count: 8 },
    ],
    weekly: [
      { label: 'Week 1', count: 95 },
      { label: 'Week 2', count: 128 },
      { label: 'Week 3', count: 142 },
      { label: 'Week 4', count: 165 },
    ],
    monthly: [
      { label: 'Apr', count: 320 },
      { label: 'May', count: 410 },
      { label: 'Jun', count: 480 },
      { label: 'Jul', count: 520 },
      { label: 'Aug', count: 610 },
      { label: 'Sep', count: 680 },
    ],
  })
  const [userGrowth, setUserGrowth] = useState<
    { month: string; patients: number; doctors: number }[]
  >([
    { month: 'Apr', patients: 120, doctors: 14 },
    { month: 'May', patients: 240, doctors: 28 },
    { month: 'Jun', patients: 450, doctors: 45 },
    { month: 'Jul', patients: 680, doctors: 62 },
    { month: 'Aug', patients: 920, doctors: 84 },
    { month: 'Sep', patients: 1250, doctors: 110 },
  ])
  const [recentAppointments, setRecentAppointments] = useState<AppointmentItem[]>([])
  const [pendingDoctors, setPendingDoctors] = useState<AdminDoctor[]>([])

  // Complaints state for bottom card
  const [complaints, setComplaints] = useState<ComplaintItem[]>([
    {
      id: 'CMP-1042',
      userName: 'Rahul Sharma',
      userRole: 'Patient',
      category: 'Slot Scheduling Delay',
      severity: 'high',
      status: 'Under Review',
      date: 'Today, 02:30 PM',
      message: 'Doctor consultation started 40 minutes after scheduled slot without notification.',
    },
    {
      id: 'CMP-1041',
      userName: 'Dr. Sarah Jenkins',
      userRole: 'Doctor',
      category: 'Billing Dispute',
      severity: 'medium',
      status: 'Investigating',
      date: 'Yesterday, 05:15 PM',
      message: 'Cancellation policy fee reconciliation pending for last-minute patient dropout.',
    },
    {
      id: 'CMP-1039',
      userName: 'Priya Patel',
      userRole: 'Patient',
      category: 'Prescription Access',
      severity: 'low',
      status: 'Resolved',
      date: 'Sep 6, 2026',
      message: 'Requested digital copy of prescription notes follow-up consultation.',
    },
  ])

  // 2. Module Data States
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [allAppointments, setAllAppointments] = useState<AppointmentItem[]>([])
  const [specializationsList, setSpecializationsList] = useState<string[]>([])

  // Search & Filter States
  const [patientSearch, setPatientSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorStatusFilter, setDoctorStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [apptStatusFilter, setApptStatusFilter] = useState<string>('all')

  // Modals & Detail Forms
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<AdminDoctor | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(defaultPatientForm())
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>(defaultDoctorForm())
  const [showHospitalForm, setShowHospitalForm] = useState(false)
  const [hospitalCreateForm, setHospitalCreateForm] = useState({ name: '', isActive: true })

  // Synchronize initial section prop
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection as NavSection)
    }
  }, [initialSection])

  // Load Dashboard & Core Module Data
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    const loadAllAdminData = async () => {
      setLoading(true)
      setError('')

      try {
        // Fetch Admin Dashboard Stats & Summaries
        const dashData = await getAdminDashboardApi(token).catch(() => null)
        if (dashData && dashData.success) {
          if (dashData.stats) setStats(dashData.stats)
          if (dashData.appointmentsOverview) setAppointmentsOverview(dashData.appointmentsOverview)
          if (dashData.userGrowth) setUserGrowth(dashData.userGrowth)
          if (dashData.recentAppointments) setRecentAppointments(dashData.recentAppointments)
          if (dashData.pendingDoctors) setPendingDoctors(dashData.pendingDoctors)
        }

        // Fetch core collections
        const [patientsData, doctorsData, hospitalsData, apptsData, specsData] = await Promise.all([
          getAllPatientsForAdmin(token).catch(() => ({ patients: [] })),
          getAllDoctorsForAdmin(token).catch(() => ({ doctors: [] })),
          getAllHospitalsForAdmin(token).catch(() => ({ hospitals: [] })),
          getAllAppointmentsForAdminApi(token).catch(() => ({ appointments: [] })),
          getSpecializations().catch(() => ({ specializations: [] })),
        ])

        const pList = patientsData.patients || []
        const dList = doctorsData.doctors || []
        const hList = hospitalsData.hospitals || []
        const aList = apptsData.appointments || []
        const sList = specsData.specializations || []

        setPatients(pList)
        setDoctors(dList)
        setHospitals(hList)
        setAllAppointments(aList)
        setSpecializationsList(sList)

        // Fallback / sync stats if backend dashboard endpoint returned default
        setStats((prev) => ({
          totalPatients: pList.length || prev.totalPatients,
          totalDoctors: dList.length || prev.totalDoctors,
          totalHospitals: hList.length || prev.totalHospitals,
          totalAppointments: aList.length || prev.totalAppointments,
          pendingDoctorApprovals: dList.filter((d) => d.verificationStatus === 'pending').length || prev.pendingDoctorApprovals,
          todayAppointments: prev.todayAppointments || Math.min(aList.length, 3),
        }))

        if (!dashData?.recentAppointments?.length && aList.length) {
          setRecentAppointments(aList.slice(0, 6))
        }
        if (!dashData?.pendingDoctors?.length && dList.length) {
          setPendingDoctors(dList.filter((d) => d.verificationStatus === 'pending').slice(0, 6))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading admin data.')
      } finally {
        setLoading(false)
      }
    }

    void loadAllAdminData()
  }, [navigate, token])

  // Handle URL item ID selection (patient or doctor view)
  useEffect(() => {
    if (!id || !token) {
      setSelectedPatient(null)
      setSelectedDoctor(null)
      return
    }

    if (activeSection === 'patients') {
      getPatientByIdForAdmin(id, token)
        .then((res) => {
          if (res.patient) {
            setSelectedPatient(res.patient)
            setPatientForm({
              gender: res.patient.gender || 'male',
              phone: res.patient.phone || '',
              address: res.patient.address || '',
              bloodGroup: res.patient.bloodGroup || 'A+',
              allergies: (res.patient.allergies || []).join(', '),
              medicalHistory: (res.patient.medicalHistory || []).join(', '),
              active: Boolean(res.patient.active),
            })
          }
        })
        .catch((err) => setError(err.message))
    } else if (activeSection === 'doctors') {
      getDoctorByIdForAdmin(id, token)
        .then((res) => {
          if (res.doctor) {
            setSelectedDoctor(res.doctor)
            setDoctorForm({
              specialization: res.doctor.specialization || '',
              qualification: res.doctor.qualification || '',
              licenseNumber: res.doctor.licenseNumber || '',
              consultationFee: String(res.doctor.consultationFee ?? 0),
              experienceYears: String(res.doctor.experienceYears ?? 0),
              available: Boolean(res.doctor.available),
              verificationStatus: res.doctor.verificationStatus || 'pending',
            })
          }
        })
        .catch((err) => setError(err.message))
    }
  }, [id, activeSection, token])

  // Quick Action: Verify Doctor
  const handleVerifyDoctor = async (doctorId: string) => {
    if (!token) return
    try {
      setSaving(true)
      setError('')
      const data = await verifyDoctorForAdmin(doctorId, token)
      setDoctors((prev) =>
        prev.map((doc) =>
          doc._id === doctorId
            ? { ...doc, verificationStatus: 'verified', available: true }
            : doc
        )
      )
      setPendingDoctors((prev) => prev.filter((doc) => doc._id !== doctorId))
      setStats((prev) => ({
        ...prev,
        pendingDoctorApprovals: Math.max(0, prev.pendingDoctorApprovals - 1),
      }))
      setSuccessMsg(data.message || 'Doctor verified successfully.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify doctor.')
    } finally {
      setSaving(false)
    }
  }

  // Quick Action: Reject Doctor
  const handleRejectDoctor = async (doctorId: string) => {
    if (!token) return
    try {
      setSaving(true)
      setError('')
      const data = await rejectDoctorForAdmin(doctorId, token)
      setDoctors((prev) =>
        prev.map((doc) =>
          doc._id === doctorId
            ? { ...doc, verificationStatus: 'rejected', available: false }
            : doc
        )
      )
      setPendingDoctors((prev) => prev.filter((doc) => doc._id !== doctorId))
      setStats((prev) => ({
        ...prev,
        pendingDoctorApprovals: Math.max(0, prev.pendingDoctorApprovals - 1),
      }))
      setSuccessMsg(data.message || 'Doctor application rejected.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject doctor.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Complaint Status
  const handleToggleComplaintStatus = (complaintId: string) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== complaintId) return c
        const nextStatus =
          c.status === 'Under Review'
            ? 'Investigating'
            : c.status === 'Investigating'
            ? 'Resolved'
            : 'Under Review'
        return { ...c, status: nextStatus }
      })
    )
  }

  // Hospital Actions
  const handleCreateHospital = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !hospitalCreateForm.name.trim()) return
    try {
      setSaving(true)
      const data = await createHospitalForAdmin(hospitalCreateForm, token)
      if (data.hospital) {
        setHospitals((prev) => [data.hospital as Hospital, ...prev])
        setStats((prev) => ({ ...prev, totalHospitals: prev.totalHospitals + 1 }))
      }
      setHospitalCreateForm({ name: '', isActive: true })
      setShowHospitalForm(false)
      setSuccessMsg('Hospital added successfully.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create hospital.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleHospitalActive = async (id: string, currentActive: boolean) => {
    if (!token) return
    try {
      setSaving(true)
      await updateHospitalByIdForAdmin(id, { isActive: !currentActive }, token)
      setHospitals((prev) =>
        prev.map((h) => (h._id === id ? { ...h, isActive: !currentActive } : h))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hospital status.')
    } finally {
      setSaving(false)
    }
  }

  // Navigation handler
  const handleNavClick = (section: NavSection) => {
    setActiveSection(section)
    setSelectedPatient(null)
    setSelectedDoctor(null)
    if (section === 'dashboard') navigate('/admin')
    else navigate(`/admin/${section}`)
  }

  // Bar Height Scaling Calculator for Overview Chart
  const activeOverviewData = appointmentsOverview[timeframe] || []
  const maxCountInOverview = Math.max(...activeOverviewData.map((d) => d.count), 1)

  return (
    <div className="admin-shell">
      {/* ========================================================
          1. SIDEBAR
          ======================================================== */}
      <aside className="admin-sidebar" aria-label="Admin Navigation Sidebar">
        {/* Brand Header */}
        <div className="admin-sidebar-brand">
          <div className="admin-logo-mark">HG</div>
          <div className="admin-brand-info">
            <span className="admin-brand-title">HealthGate</span>
            <span className="admin-portal-tag">Admin Portal</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="admin-sidebar-nav">
          {/* CORE */}
          <div className="admin-nav-group">
            <span className="admin-nav-group-title">Core</span>
            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <div className="admin-nav-item-content">
                <DashboardIcon size={18} />
                <span>Dashboard</span>
              </div>
            </button>
          </div>

          {/* MANAGEMENT MODULES */}
          <div className="admin-nav-group">
            <span className="admin-nav-group-title">Management</span>
            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'patients' ? 'active' : ''}`}
              onClick={() => handleNavClick('patients')}
            >
              <div className="admin-nav-item-content">
                <UsersIcon size={18} />
                <span>Patients</span>
              </div>
              <span className="admin-nav-badge">{stats.totalPatients}</span>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'doctors' ? 'active' : ''}`}
              onClick={() => handleNavClick('doctors')}
            >
              <div className="admin-nav-item-content">
                <StethoscopeIcon size={18} />
                <span>Doctors</span>
              </div>
              {stats.pendingDoctorApprovals > 0 ? (
                <span className="admin-nav-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                  {stats.pendingDoctorApprovals} New
                </span>
              ) : (
                <span className="admin-nav-badge">{stats.totalDoctors}</span>
              )}
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'hospitals' ? 'active' : ''}`}
              onClick={() => handleNavClick('hospitals')}
            >
              <div className="admin-nav-item-content">
                <HospitalIcon size={18} />
                <span>Hospitals</span>
              </div>
              <span className="admin-nav-badge">{stats.totalHospitals}</span>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'appointments' ? 'active' : ''}`}
              onClick={() => handleNavClick('appointments')}
            >
              <div className="admin-nav-item-content">
                <CalendarIcon size={18} />
                <span>Appointments</span>
              </div>
              <span className="admin-nav-badge">{stats.totalAppointments}</span>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'specializations' ? 'active' : ''}`}
              onClick={() => handleNavClick('specializations')}
            >
              <div className="admin-nav-item-content">
                <HeartPulseIcon size={18} />
                <span>Specializations</span>
              </div>
            </button>
          </div>

          {/* OPERATIONS */}
          <div className="admin-nav-group">
            <span className="admin-nav-group-title">Operations</span>
            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'payments' ? 'active' : ''}`}
              onClick={() => handleNavClick('payments')}
            >
              <div className="admin-nav-item-content">
                <CreditCardIcon size={18} />
                <span>Payments</span>
              </div>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'complaints' ? 'active' : ''}`}
              onClick={() => handleNavClick('complaints')}
            >
              <div className="admin-nav-item-content">
                <MessageSquareIcon size={18} />
                <span>Complaints</span>
              </div>
              <span className="admin-nav-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                {complaints.filter((c) => c.status !== 'Resolved').length}
              </span>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeSection === 'reports' ? 'active' : ''}`}
              onClick={() => handleNavClick('reports')}
            >
              <div className="admin-nav-item-content">
                <TrendingUpIcon size={18} />
                <span>Reports</span>
              </div>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="admin-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.name || 'Administrator'}</span>
              <span className="admin-user-role">Super Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={onLogout}
            title="Log out of Admin Portal"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ========================================================
          2. MAIN CONTENT VIEWPORT
          ======================================================== */}
      <div className="admin-main-viewport">
        {/* Top Header Bar */}
        <header className="admin-top-header">
          <div className="admin-header-left">
            <h1 className="admin-header-title">
              {activeSection === 'dashboard'
                ? 'System Executive Dashboard'
                : activeSection.charAt(0).toUpperCase() + activeSection.slice(1) + ' Management'}
            </h1>
          </div>

          <div className="admin-header-right">
            <div className="admin-live-badge">
              <span className="admin-pulse-dot" />
              <span>System Live</span>
            </div>
            <span className="admin-header-date">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="admin-content-body">
          {/* Feedback Banners */}
          {error && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                borderRadius: '12px',
                background: '#fef2f2',
                color: '#991b1b',
                border: '1.5px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircleIcon size={18} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991b1b' }}
              >
                <CloseIcon size={16} />
              </button>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#065f46',
                border: '1.5px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircleIcon size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================
              DASHBOARD HOMEPAGE VIEW (ADMIN DASHBOARD — V1)
              ======================================================== */}
          {activeSection === 'dashboard' && (
            <div className="admin-dashboard-view">
              {/* ----------------------------------------------------
                  TOP: 6 METRIC CARDS
                  ---------------------------------------------------- */}
              <section className="admin-metrics-grid" aria-label="System Metrics">
                {/* 1. Total Patients */}
                <div className="admin-metric-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon patients">
                      <UsersIcon size={20} />
                    </div>
                    <span className="admin-metric-tag blue">Registered</span>
                  </div>
                  <span className="admin-metric-val">{loading ? '-' : stats.totalPatients}</span>
                  <span className="admin-metric-label">Total Patients</span>
                </div>

                {/* 2. Total Doctors */}
                <div className="admin-metric-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon doctors">
                      <StethoscopeIcon size={20} />
                    </div>
                    <span className="admin-metric-tag teal">Verified Staff</span>
                  </div>
                  <span className="admin-metric-val">{loading ? '-' : stats.totalDoctors}</span>
                  <span className="admin-metric-label">Total Doctors</span>
                </div>

                {/* 3. Total Hospitals */}
                <div className="admin-metric-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon hospitals">
                      <HospitalIcon size={20} />
                    </div>
                    <span className="admin-metric-tag teal">Accredited</span>
                  </div>
                  <span className="admin-metric-val">{loading ? '-' : stats.totalHospitals}</span>
                  <span className="admin-metric-label">Total Hospitals</span>
                </div>

                {/* 4. Total Appointments */}
                <div className="admin-metric-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon appointments">
                      <CalendarIcon size={20} />
                    </div>
                    <span className="admin-metric-tag blue">Booked</span>
                  </div>
                  <span className="admin-metric-val">{loading ? '-' : stats.totalAppointments}</span>
                  <span className="admin-metric-label">Total Appointments</span>
                </div>

                {/* 5. Pending Doctor Approvals */}
                <div className="admin-metric-card alert-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon pending">
                      <ShieldCheckIcon size={20} />
                    </div>
                    <span className="admin-metric-tag amber">Action Req</span>
                  </div>
                  <span className="admin-metric-val" style={{ color: '#b45309' }}>
                    {loading ? '-' : stats.pendingDoctorApprovals}
                  </span>
                  <span className="admin-metric-label">Pending Doctor Approvals</span>
                </div>

                {/* 6. Today's Appointments */}
                <div className="admin-metric-card">
                  <div className="admin-metric-top">
                    <div className="admin-metric-icon today">
                      <ClockIcon size={20} />
                    </div>
                    <span className="admin-metric-tag green">Live Today</span>
                  </div>
                  <span className="admin-metric-val" style={{ color: '#047857' }}>
                    {loading ? '-' : stats.todayAppointments}
                  </span>
                  <span className="admin-metric-label">Today's Appointments</span>
                </div>
              </section>

              {/* ----------------------------------------------------
                  MIDDLE: 2 COLUMNS (Appointments Overview & User Growth)
                  ---------------------------------------------------- */}
              <section className="admin-middle-grid">
                {/* Appointments Overview */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title-wrap">
                      <h3 className="admin-panel-title">
                        <TrendingUpIcon size={18} />
                        <span>Appointments Overview</span>
                      </h3>
                      <span className="admin-panel-sub">
                        Volume distribution across healthcare network
                      </span>
                    </div>

                    <div className="admin-timeframe-tabs">
                      <button
                        type="button"
                        className={`admin-tf-tab ${timeframe === 'daily' ? 'active' : ''}`}
                        onClick={() => setTimeframe('daily')}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        className={`admin-tf-tab ${timeframe === 'weekly' ? 'active' : ''}`}
                        onClick={() => setTimeframe('weekly')}
                      >
                        Weekly
                      </button>
                      <button
                        type="button"
                        className={`admin-tf-tab ${timeframe === 'monthly' ? 'active' : ''}`}
                        onClick={() => setTimeframe('monthly')}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {/* Visual Chart Bars */}
                  <div className="admin-chart-bars-wrap">
                    {activeOverviewData.map((item, idx) => {
                      const heightPercent = Math.max(
                        10,
                        Math.round((item.count / maxCountInOverview) * 100)
                      )
                      return (
                        <div key={idx} className="admin-bar-col">
                          <span className="admin-bar-val">{item.count}</span>
                          <div className="admin-bar-track">
                            <div
                              className="admin-bar-fill"
                              style={{ height: `${heightPercent}%` }}
                              title={`${item.label}: ${item.count} appointments`}
                            />
                          </div>
                          <span className="admin-bar-label">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    <span>Average Daily Volume: ~18 Visits</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                      94% Consultation Fulfillment Rate
                    </span>
                  </div>
                </div>

                {/* User Growth */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title-wrap">
                      <h3 className="admin-panel-title">
                        <UsersIcon size={18} />
                        <span>User Growth</span>
                      </h3>
                      <span className="admin-panel-sub">
                        Patients vs Doctor community acquisition
                      </span>
                    </div>
                  </div>

                  <div className="admin-growth-content">
                    <div className="admin-growth-ratio-box">
                      <div className="admin-growth-card">
                        <span className="admin-growth-card-val" style={{ color: '#0284c7' }}>
                          {stats.totalPatients}
                        </span>
                        <div className="admin-growth-card-lbl">Patients (+18% MoM)</div>
                      </div>
                      <div className="admin-growth-card">
                        <span className="admin-growth-card-val" style={{ color: '#0d5c63' }}>
                          {stats.totalDoctors}
                        </span>
                        <div className="admin-growth-card-lbl">Doctors (+12% MoM)</div>
                      </div>
                    </div>

                    <div className="admin-growth-timeline">
                      {userGrowth.slice(-4).map((ug, idx) => {
                        const total = (ug.patients || 0) + (ug.doctors || 0) || 1
                        const pPct = Math.round(((ug.patients || 0) / total) * 100)
                        const dPct = 100 - pPct
                        return (
                          <div key={idx} className="admin-growth-row">
                            <div className="admin-growth-row-header">
                              <span>{ug.month}</span>
                              <span style={{ color: '#64748b' }}>
                                {ug.patients} Patients • {ug.doctors} Doctors
                              </span>
                            </div>
                            <div className="admin-growth-meter-track">
                              <div
                                className="admin-growth-meter-fill patients"
                                style={{ width: `${pPct}%` }}
                                title={`Patients: ${pPct}%`}
                              />
                              <div
                                className="admin-growth-meter-fill doctors"
                                style={{ width: `${dPct}%` }}
                                title={`Doctors: ${dPct}%`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* ----------------------------------------------------
                  BOTTOM: 3 PANELS GRID (Appointments, Approvals, Complaints)
                  ---------------------------------------------------- */}
              <section className="admin-bottom-grid">
                {/* 1. Recent Appointments */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title-wrap">
                      <h3 className="admin-panel-title">
                        <CalendarIcon size={18} />
                        <span>Recent Appointments</span>
                      </h3>
                      <span className="admin-panel-sub">Latest consultations logged</span>
                    </div>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => handleNavClick('appointments')}
                    >
                      View All →
                    </button>
                  </div>

                  <div className="admin-table-list">
                    {recentAppointments.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                        No recent appointments found.
                      </p>
                    ) : (
                      recentAppointments.slice(0, 5).map((appt) => (
                        <div key={appt._id} className="admin-appt-item">
                          <div className="admin-appt-details">
                            <span className="admin-appt-patient">
                              {appt.patient?.name || 'Patient'}
                            </span>
                            <span className="admin-appt-meta">
                              Dr. {appt.doctor?.user?.name || 'Doctor'} •{' '}
                              {appt.appointmentDate
                                ? new Date(appt.appointmentDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Today'}{' '}
                              • {appt.timeSlot || '10:00 AM'}
                            </span>
                          </div>
                          <span className={`admin-status-pill ${appt.status || 'scheduled'}`}>
                            {appt.status || 'Scheduled'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Pending Doctor Approvals */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title-wrap">
                      <h3 className="admin-panel-title">
                        <ShieldCheckIcon size={18} />
                        <span>Pending Approvals</span>
                      </h3>
                      <span className="admin-panel-sub">Verification review requests</span>
                    </div>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => handleNavClick('doctors')}
                    >
                      Manage ({stats.pendingDoctorApprovals}) →
                    </button>
                  </div>

                  <div className="admin-table-list">
                    {pendingDoctors.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 0', color: '#10b981' }}>
                        <CheckCircleIcon size={28} />
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>
                          All doctor applications verified!
                        </p>
                      </div>
                    ) : (
                      pendingDoctors.slice(0, 4).map((doc) => (
                        <div key={doc._id} className="admin-pending-item">
                          <div className="admin-pending-info">
                            <div>
                              <div className="admin-doc-name">{doc.user?.name || 'Doctor'}</div>
                              <div className="admin-doc-spec">
                                {doc.specialization || 'General Practice'} • {doc.qualification || 'MBBS'}
                              </div>
                              <div className="admin-doc-exp">
                                License: {doc.licenseNumber || 'Verified in Review'} •{' '}
                                {doc.experienceYears || 0} yrs exp
                              </div>
                            </div>
                            <span className="admin-severity-pill medium">Pending</span>
                          </div>

                          <div className="admin-approval-actions">
                            <button
                              type="button"
                              className="admin-btn-approve"
                              disabled={saving}
                              onClick={() => handleVerifyDoctor(doc._id || '')}
                            >
                              <CheckCircleIcon size={14} /> Approve
                            </button>
                            <button
                              type="button"
                              className="admin-btn-reject"
                              disabled={saving}
                              onClick={() => handleRejectDoctor(doc._id || '')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Recent Complaints */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title-wrap">
                      <h3 className="admin-panel-title">
                        <MessageSquareIcon size={18} />
                        <span>Recent Complaints</span>
                      </h3>
                      <span className="admin-panel-sub">Patient & Doctor issue reports</span>
                    </div>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => handleNavClick('complaints')}
                    >
                      All Triage →
                    </button>
                  </div>

                  <div className="admin-table-list">
                    {complaints.map((cmp) => (
                      <div key={cmp.id} className="admin-complaint-item">
                        <div className="admin-complaint-top">
                          <span className="admin-complaint-cat">{cmp.category}</span>
                          <span className={`admin-severity-pill ${cmp.severity}`}>
                            {cmp.severity}
                          </span>
                        </div>

                        <p className="admin-complaint-desc">{cmp.message}</p>

                        <div className="admin-complaint-footer">
                          <span>
                            {cmp.userName} ({cmp.userRole})
                          </span>
                          <button
                            type="button"
                            className="admin-tf-tab"
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              background: cmp.status === 'Resolved' ? '#d1fae5' : '#fef3c7',
                              color: cmp.status === 'Resolved' ? '#065f46' : '#92400e',
                            }}
                            onClick={() => handleToggleComplaintStatus(cmp.id)}
                            title="Click to toggle resolution status"
                          >
                            {cmp.status}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ========================================================
              MODULE 1: PATIENTS MANAGEMENT
              ======================================================== */}
          {activeSection === 'patients' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Patient Profiles & Records
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Manage registered patients, personal health records and access status
                  </span>
                </div>

                <div className="admin-search-bar">
                  <SearchIcon size={16} />
                  <input
                    type="text"
                    placeholder="Search patient name or email..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="admin-search-input"
                  />
                </div>
              </div>

              {selectedPatient ? (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Editing Profile: {selectedPatient.user?.name}
                    </h3>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => setSelectedPatient(null)}
                    >
                      Close Edit Form
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!token || !selectedPatient._id) return
                      try {
                        setSaving(true)
                        const payload = {
                          gender: patientForm.gender,
                          phone: patientForm.phone,
                          address: patientForm.address,
                          bloodGroup: patientForm.bloodGroup,
                          allergies: normalizeList(patientForm.allergies),
                          medicalHistory: normalizeList(patientForm.medicalHistory),
                          active: patientForm.active,
                        }
                        const res = await updatePatientByIdForAdmin(selectedPatient._id, payload, token)
                        if (res.patient) {
                          setPatients((prev) =>
                            prev.map((p) => (p._id === selectedPatient._id ? res.patient! : p))
                          )
                        }
                        setSuccessMsg('Patient profile updated successfully.')
                        setSelectedPatient(null)
                        setTimeout(() => setSuccessMsg(''), 3000)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Update failed.')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}
                  >
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Phone Number</label>
                      <input
                        type="text"
                        value={patientForm.phone}
                        onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Gender</label>
                      <select
                        value={patientForm.gender}
                        onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Blood Group</label>
                      <input
                        type="text"
                        value={patientForm.bloodGroup}
                        onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Address</label>
                      <input
                        type="text"
                        value={patientForm.address}
                        onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 3', display: 'flex', gap: '10px' }}>
                      <button type="submit" className="admin-btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Patient Profile'}
                      </button>
                      <button
                        type="button"
                        className="admin-tf-tab"
                        onClick={() => setSelectedPatient(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Contact</th>
                    <th>Blood Group</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients
                    .filter((p) => {
                      const query = patientSearch.toLowerCase().trim()
                      if (!query) return true
                      return (
                        p.user?.name?.toLowerCase().includes(query) ||
                        p.user?.email?.toLowerCase().includes(query) ||
                        p.phone?.toLowerCase().includes(query)
                      )
                    })
                    .map((p) => (
                      <tr key={p._id}>
                        <td>
                          <strong>{p.user?.name || 'Patient'}</strong>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{p.user?.email}</div>
                        </td>
                        <td>{p.phone || 'Not provided'}</td>
                        <td>{p.bloodGroup || 'N/A'}</td>
                        <td>
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </td>
                        <td>
                          <span
                            className="admin-severity-pill"
                            style={{
                              background: p.active !== false ? '#ecfdf5' : '#fee2e2',
                              color: p.active !== false ? '#065f46' : '#991b1b',
                            }}
                          >
                            {p.active !== false ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="admin-tf-tab"
                              onClick={() => {
                                setSelectedPatient(p)
                                setPatientForm({
                                  gender: p.gender || 'male',
                                  phone: p.phone || '',
                                  address: p.address || '',
                                  bloodGroup: p.bloodGroup || 'A+',
                                  allergies: (p.allergies || []).join(', '),
                                  medicalHistory: (p.medicalHistory || []).join(', '),
                                  active: Boolean(p.active),
                                })
                              }}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              className="admin-tf-tab"
                              style={{ color: p.active !== false ? '#b91c1c' : '#059669' }}
                              onClick={async () => {
                                if (!token || !p._id) return
                                try {
                                  const res = await togglePatientStatusForAdmin(p._id, token)
                                  setPatients((prev) =>
                                    prev.map((item) =>
                                      item._id === p._id ? { ...item, active: res.patient?.active } : item
                                    )
                                  )
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'Action failed.')
                                }
                              }}
                            >
                              {p.active !== false ? 'Block' : 'Unblock'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================
              MODULE 2: DOCTORS MANAGEMENT
              ======================================================== */}
          {activeSection === 'doctors' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Doctor Credentials & Practitioners
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Review medical licenses, verification approvals, and active practice statuses
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="admin-timeframe-tabs">
                    <button
                      type="button"
                      className={`admin-tf-tab ${doctorStatusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setDoctorStatusFilter('all')}
                    >
                      All ({doctors.length})
                    </button>
                    <button
                      type="button"
                      className={`admin-tf-tab ${doctorStatusFilter === 'pending' ? 'active' : ''}`}
                      onClick={() => setDoctorStatusFilter('pending')}
                    >
                      Pending ({doctors.filter((d) => d.verificationStatus === 'pending').length})
                    </button>
                    <button
                      type="button"
                      className={`admin-tf-tab ${doctorStatusFilter === 'verified' ? 'active' : ''}`}
                      onClick={() => setDoctorStatusFilter('verified')}
                    >
                      Verified
                    </button>
                  </div>

                  <div className="admin-search-bar" style={{ width: '220px' }}>
                    <SearchIcon size={16} />
                    <input
                      type="text"
                      placeholder="Search doctor..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="admin-search-input"
                    />
                  </div>
                </div>
              </div>

              {selectedDoctor ? (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Editing Doctor Credentials: Dr. {selectedDoctor.user?.name}
                    </h3>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => setSelectedDoctor(null)}
                    >
                      Close Edit Form
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!token || !selectedDoctor._id) return
                      try {
                        setSaving(true)
                        const payload = {
                          specialization: doctorForm.specialization,
                          qualification: doctorForm.qualification,
                          licenseNumber: doctorForm.licenseNumber,
                          consultationFee: Number(doctorForm.consultationFee) || 0,
                          experienceYears: Number(doctorForm.experienceYears) || 0,
                          available: doctorForm.available,
                          verificationStatus: doctorForm.verificationStatus,
                        }
                        const res = await updateDoctorByIdForAdmin(selectedDoctor._id, payload, token)
                        if (res.doctor) {
                          setDoctors((prev) =>
                            prev.map((d) => (d._id === selectedDoctor._id ? res.doctor! : d))
                          )
                        }
                        setSuccessMsg('Doctor credentials updated successfully.')
                        setSelectedDoctor(null)
                        setTimeout(() => setSuccessMsg(''), 3000)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Doctor update failed.')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}
                  >
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Specialization</label>
                      <input
                        type="text"
                        value={doctorForm.specialization}
                        onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Qualification</label>
                      <input
                        type="text"
                        value={doctorForm.qualification}
                        onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>License Number</label>
                      <input
                        type="text"
                        value={doctorForm.licenseNumber}
                        onChange={(e) => setDoctorForm({ ...doctorForm, licenseNumber: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Consultation Fee ($)</label>
                      <input
                        type="number"
                        value={doctorForm.consultationFee}
                        onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Experience (Years)</label>
                      <input
                        type="number"
                        value={doctorForm.experienceYears}
                        onChange={(e) => setDoctorForm({ ...doctorForm, experienceYears: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Verification Status</label>
                      <select
                        value={doctorForm.verificationStatus}
                        onChange={(e) =>
                          setDoctorForm({
                            ...doctorForm,
                            verificationStatus: e.target.value as 'pending' | 'verified' | 'rejected',
                          })
                        }
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 3', display: 'flex', gap: '10px' }}>
                      <button type="submit" className="admin-btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Doctor Credentials'}
                      </button>
                      <button
                        type="button"
                        className="admin-tf-tab"
                        onClick={() => setSelectedDoctor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Practitioner</th>
                    <th>Specialty</th>
                    <th>Hospital Affiliation</th>
                    <th>License #</th>
                    <th>Verification</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors
                    .filter((d) => {
                      if (doctorStatusFilter !== 'all' && d.verificationStatus !== doctorStatusFilter) {
                        return false
                      }
                      const query = doctorSearch.toLowerCase().trim()
                      if (!query) return true
                      return (
                        d.user?.name?.toLowerCase().includes(query) ||
                        d.specialization?.toLowerCase().includes(query) ||
                        d.licenseNumber?.toLowerCase().includes(query)
                      )
                    })
                    .map((d) => (
                      <tr key={d._id}>
                        <td>
                          <strong>{d.user?.name || 'Doctor'}</strong>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{d.user?.email}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#0d5c63' }}>
                            {d.specialization || 'General'}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {d.qualification || 'MBBS'} • {d.experienceYears || 0} yrs
                          </div>
                        </td>
                        <td>{d.hospital?.name || 'Independent Practice'}</td>
                        <td><code>{d.licenseNumber || 'N/A'}</code></td>
                        <td>
                          <span
                            className="admin-severity-pill"
                            style={{
                              background:
                                d.verificationStatus === 'verified'
                                  ? '#d1fae5'
                                  : d.verificationStatus === 'rejected'
                                  ? '#fee2e2'
                                  : '#fef3c7',
                              color:
                                d.verificationStatus === 'verified'
                                  ? '#065f46'
                                  : d.verificationStatus === 'rejected'
                                  ? '#991b1b'
                                  : '#92400e',
                            }}
                          >
                            {d.verificationStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="admin-tf-tab"
                              onClick={() => {
                                setSelectedDoctor(d)
                                setDoctorForm({
                                  specialization: d.specialization || '',
                                  qualification: d.qualification || '',
                                  licenseNumber: d.licenseNumber || '',
                                  consultationFee: String(d.consultationFee ?? 0),
                                  experienceYears: String(d.experienceYears ?? 0),
                                  available: d.available !== false,
                                  verificationStatus: d.verificationStatus || 'pending',
                                })
                              }}
                            >
                              Edit
                            </button>
                            {d.verificationStatus === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-btn-approve"
                                  style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                  onClick={() => handleVerifyDoctor(d._id || '')}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-reject"
                                  style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                  onClick={() => handleRejectDoctor(d._id || '')}
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="admin-tf-tab"
                                onClick={() => {
                                  if (d.verificationStatus === 'verified') {
                                    handleRejectDoctor(d._id || '')
                                  } else {
                                    handleVerifyDoctor(d._id || '')
                                  }
                                }}
                              >
                                {d.verificationStatus === 'verified' ? 'Revoke Status' : 'Re-verify'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================
              MODULE 3: HOSPITALS MANAGEMENT
              ======================================================== */}
          {activeSection === 'hospitals' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Hospitals & Medical Centers
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Accredited clinics, hospital branches, and healthcare networks
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="admin-search-bar" style={{ width: '220px' }}>
                    <SearchIcon size={16} />
                    <input
                      type="text"
                      placeholder="Search hospital..."
                      value={hospitalSearch}
                      onChange={(e) => setHospitalSearch(e.target.value)}
                      className="admin-search-input"
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => setShowHospitalForm((prev) => !prev)}
                  >
                    + Add Hospital
                  </button>
                </div>
              </div>

              {showHospitalForm && (
                <form
                  onSubmit={handleCreateHospital}
                  style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter hospital or clinic name..."
                    value={hospitalCreateForm.name}
                    onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, name: e.target.value })}
                    style={{ flex: 1, padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    required
                  />
                  <select
                    value={hospitalCreateForm.isActive ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setHospitalCreateForm({ ...hospitalCreateForm, isActive: e.target.value === 'active' })
                    }
                    style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="active">Active Network</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    Create Center
                  </button>
                  <button
                    type="button"
                    className="admin-tf-tab"
                    onClick={() => setShowHospitalForm(false)}
                  >
                    Cancel
                  </button>
                </form>
              )}

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Hospital Center</th>
                    <th>Affiliated Doctors</th>
                    <th>Network Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals
                    .filter((h) => {
                      const q = hospitalSearch.toLowerCase().trim()
                      if (!q) return true
                      return (h.name || '').toLowerCase().includes(q)
                    })
                    .map((h) => {
                      const docCount = doctors.filter((d) => d.hospital?._id === h._id).length
                      return (
                        <tr key={h._id}>
                          <td>
                            <strong>{h.name}</strong>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{docCount}</span> practitioners
                          </td>
                          <td>
                            <span
                              className="admin-severity-pill"
                              style={{
                                background: h.isActive ? '#d1fae5' : '#fee2e2',
                                color: h.isActive ? '#065f46' : '#991b1b',
                              }}
                            >
                              {h.isActive ? 'Active Center' : 'Deactivated'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-tf-tab"
                              onClick={() => handleToggleHospitalActive(h._id || '', Boolean(h.isActive))}
                            >
                              {h.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================
              MODULE 4: APPOINTMENTS MANAGEMENT
              ======================================================== */}
          {activeSection === 'appointments' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Consultation Appointments
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    System-wide patient reservations, medical slots, and consultation logs
                  </span>
                </div>

                <div className="admin-timeframe-tabs">
                  {['all', 'scheduled', 'confirmed', 'completed', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`admin-tf-tab ${apptStatusFilter === st ? 'active' : ''}`}
                      onClick={() => setApptStatusFilter(st)}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Date & Time</th>
                    <th>Format</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allAppointments
                    .filter((a) => (apptStatusFilter === 'all' ? true : a.status === apptStatusFilter))
                    .map((a) => (
                      <tr key={a._id}>
                        <td>
                          <strong>{a.patient?.name || 'Patient'}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{a.patient?.email}</div>
                        </td>
                        <td>
                          <strong>Dr. {a.doctor?.user?.name || 'Doctor'}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#0d5c63' }}>
                            {a.doctor?.specialization || 'Specialist'}
                          </div>
                        </td>
                        <td>
                          {a.appointmentDate
                            ? new Date(a.appointmentDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'N/A'}{' '}
                          • {a.timeSlot || '10:00 AM'}
                        </td>
                        <td>
                          <span className="admin-metric-tag blue">{a.type || 'In-Person'}</span>
                        </td>
                        <td style={{ maxWidth: '200px', fontSize: '0.78rem' }}>
                          {a.reason || 'General Consultation'}
                        </td>
                        <td>
                          <span className={`admin-status-pill ${a.status || 'scheduled'}`}>
                            {a.status || 'Scheduled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================
              MODULE 5: SPECIALIZATIONS MANAGEMENT
              ======================================================== */}
          {activeSection === 'specializations' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Medical Specializations
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Active clinical departments and specialist taxonomy
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {specializationsList.map((spec) => {
                  const docCount = doctors.filter(
                    (d) => d.specialization?.toLowerCase() === spec.toLowerCase()
                  ).length
                  return (
                    <div
                      key={spec}
                      style={{
                        padding: '18px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <HeartPulseIcon size={20} style={{ color: '#0d5c63' }} />
                        <strong style={{ fontSize: '0.96rem' }}>{spec}</strong>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {docCount} Registered Doctor{docCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE SHELLS: PAYMENTS, COMPLAINTS, REPORTS
              "Build the dashboard shell first, then implement each management module one by one"
              ======================================================== */}
          {['payments', 'complaints', 'reports'].includes(activeSection) && (
            <div className="admin-placeholder-shell">
              <div className="admin-placeholder-icon">
                {activeSection === 'payments' && <CreditCardIcon size={32} />}
                {activeSection === 'complaints' && <MessageSquareIcon size={32} />}
                {activeSection === 'reports' && <TrendingUpIcon size={32} />}
              </div>

              <h2 className="admin-placeholder-title">
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Module Shell
              </h2>

              <p className="admin-placeholder-desc">
                The {activeSection} management module architecture is provisioned in the dashboard shell.
                Detailed transactions, automated settlement workflows, and configuration policies are ready
                for module-by-module expansion.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="admin-placeholder-tag">
                  <ShieldCheckIcon size={14} /> Shell Ready for Implementation
                </span>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => handleNavClick('dashboard')}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboardPage
