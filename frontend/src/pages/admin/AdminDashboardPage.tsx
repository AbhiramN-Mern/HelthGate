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
  toggleHospitalStatusApi,
  verifyHospitalApi,
  getAllHospitalDoctorsForAdminApi,
  approveDoctorHospitalRequestApi,
  rejectDoctorHospitalRequestApi,
  associateDoctorWithHospitalApi,
  removeDoctorFromHospitalApi,
  getHospitalDoctorHistoryApi,
  getAdminDashboardApi,
  getAllAppointmentsForAdminApi,
  adminRescheduleAppointmentApi,
  adminCancelAppointmentApi,
  getDoctorBookedSlotsApi,
  getSpecializations,
  getPaymentsApi,
  getFriendlyErrorMessage,
  type AdminDoctor,
  type AdminPatient,
  type Hospital,
  type HospitalDoctorItem,
  type AppointmentItem,
  type AdminDashboardStats,
  type PaymentRecord,
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
  MenuIcon,
} from '../../components/common/Icons'
import { Pagination } from '../../components/common/Pagination'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      { label: 'Mon', date: '', count: 0 },
      { label: 'Tue', date: '', count: 0 },
      { label: 'Wed', date: '', count: 0 },
      { label: 'Thu', date: '', count: 0 },
      { label: 'Fri', date: '', count: 0 },
      { label: 'Sat', date: '', count: 0 },
      { label: 'Sun', date: '', count: 0 },
    ],
    weekly: [
      { label: 'Week 1', count: 0 },
      { label: 'Week 2', count: 0 },
      { label: 'Week 3', count: 0 },
      { label: 'Week 4', count: 0 },
    ],
    monthly: [
      { label: 'Jan', count: 0 },
      { label: 'Feb', count: 0 },
      { label: 'Mar', count: 0 },
      { label: 'Apr', count: 0 },
      { label: 'May', count: 0 },
      { label: 'Jun', count: 0 },
    ],
  })
  const [userGrowth, setUserGrowth] = useState<
    { month: string; patients: number; doctors: number }[]
  >([])
  const [recentAppointments, setRecentAppointments] = useState<AppointmentItem[]>([])
  const [pendingDoctors, setPendingDoctors] = useState<AdminDoctor[]>([])

  // Complaints state for bottom card
  const [complaints, setComplaints] = useState<ComplaintItem[]>([])

  // 2. Module Data States
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [allAppointments, setAllAppointments] = useState<AppointmentItem[]>([])
  const [specializationsList, setSpecializationsList] = useState<string[]>([])
  const [adminPayments, setAdminPayments] = useState<PaymentRecord[]>([])

  // Search & Filter States
  const [patientSearch, setPatientSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorStatusFilter, setDoctorStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [apptStatusFilter, setApptStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [paymentSearch, setPaymentSearch] = useState('')

  // Server-Side Pagination States
  const [patientPage, setPatientPage] = useState(1)
  const [patientTotalPages, setPatientTotalPages] = useState(1)
  const [patientTotalItems, setPatientTotalItems] = useState(0)
  const [patientLoading, setPatientLoading] = useState(false)

  const [doctorPage, setDoctorPage] = useState(1)
  const [doctorTotalPages, setDoctorTotalPages] = useState(1)
  const [doctorTotalItems, setDoctorTotalItems] = useState(0)
  const [doctorLoading, setDoctorLoading] = useState(false)

  const [apptPage, setApptPage] = useState(1)
  const [apptTotalPages, setApptTotalPages] = useState(1)
  const [apptTotalItems, setApptTotalItems] = useState(0)
  const [apptLoading, setApptLoading] = useState(false)

  const [hospitalPage, setHospitalPage] = useState(1)
  const [hospitalTotalPages, setHospitalTotalPages] = useState(1)
  const [hospitalTotalItems, setHospitalTotalItems] = useState(0)
  const [hospitalLoading, setHospitalLoading] = useState(false)

  const [adminPaymentPage, setAdminPaymentPage] = useState(1)
  const [adminPaymentTotalPages, setAdminPaymentTotalPages] = useState(1)
  const [adminPaymentTotalItems, setAdminPaymentTotalItems] = useState(0)
  const [adminPaymentLoading, setAdminPaymentLoading] = useState(false)

  // Modals & Detail Forms
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<AdminDoctor | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(defaultPatientForm())
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>(defaultDoctorForm())

  // Admin Appointment Actions (Reschedule & Cancel Override)
  const [adminRescheduleAppt, setAdminRescheduleAppt] = useState<AppointmentItem | null>(null)
  const [adminRescheduleDate, setAdminRescheduleDate] = useState<string>('')
  const [adminRescheduleTimeSlot, setAdminRescheduleTimeSlot] = useState<string>('')
  const [adminRescheduleReason, setAdminRescheduleReason] = useState<string>('')
  const [adminRescheduleBookedSlots, setAdminRescheduleBookedSlots] = useState<string[]>([])
  const [adminRescheduleDoctorSlots, setAdminRescheduleDoctorSlots] = useState<string[]>([])
  const [adminRescheduleLoadingSlots, setAdminRescheduleLoadingSlots] = useState<boolean>(false)
  const [adminRescheduleSubmitting, setAdminRescheduleSubmitting] = useState<boolean>(false)
  const [adminRescheduleError, setAdminRescheduleError] = useState<string | null>(null)

  const [adminCancelAppt, setAdminCancelAppt] = useState<AppointmentItem | null>(null)
  const [adminCancelReason, setAdminCancelReason] = useState<string>('')
  const [adminCancelSubmitting, setAdminCancelSubmitting] = useState<boolean>(false)
  const [adminCancelError, setAdminCancelError] = useState<string | null>(null)


  // Hospital & Doctor-Hospital Affiliations State
  const [hospitalTab, setHospitalTab] = useState<'directory' | 'requests' | 'associations' | 'history'>('directory')
  const [hospitalFilterStatus, setHospitalFilterStatus] = useState<'all' | 'active' | 'inactive' | 'verified'>('all')
  const [hospitalDoctors, setHospitalDoctors] = useState<HospitalDoctorItem[]>([])
  const [hospitalDoctorHistory, setHospitalDoctorHistory] = useState<HospitalDoctorItem[]>([])
  const [showHospitalForm, setShowHospitalForm] = useState(false)
  const [hospitalCreateForm, setHospitalCreateForm] = useState({
    name: '',
    licenseNumber: '',
    street: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    website: '',
    departments: 'General Medicine, Cardiology, Pediatrics, Orthopedics, Emergency',
    isActive: true,
    verificationStatus: 'verified',
  })
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [showAssociateModal, setShowAssociateModal] = useState(false)
  const [assocForm, setAssocForm] = useState({ doctorId: '', hospitalId: '', department: '' })
  const [rejectingRequest, setRejectingRequest] = useState<HospitalDoctorItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewingHospitalDetails, setViewingHospitalDetails] = useState<Hospital | null>(null)

  // Complaints Module State
  type ComplaintStatus = 'all' | 'Pending Review' | 'Under Investigation' | 'Resolved'
  const [complaintFilter, setComplaintFilter] = useState<ComplaintStatus>('all')
  const [complaintSearch, setComplaintSearch] = useState('')
  const [complaintFeedback, setComplaintFeedback] = useState<string | null>(null)
  type DetailedComplaint = {
    id: string
    ticketId: string
    complainantName: string
    complainantEmail: string
    role: string
    category: string
    subject: string
    description: string
    priority: string
    status: 'Pending Review' | 'Under Investigation' | 'Resolved'
    createdAt: string
  }
  const [complaintsList, setComplaintsList] = useState<DetailedComplaint[]>([])

  // Reports Module State
  const [reportTimeframe, setReportTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [exportingReport, setExportingReport] = useState(false)
  const [reportSuccessNotice, setReportSuccessNotice] = useState<string | null>(null)

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
        const [patientsData, doctorsData, hospitalsData, apptsData, specsData, hospitalDocsData, historyData, paymentsData] = await Promise.all([
          getAllPatientsForAdmin(token).catch(() => ({ patients: [] })),
          getAllDoctorsForAdmin(token).catch(() => ({ doctors: [] })),
          getAllHospitalsForAdmin(token).catch(() => ({ hospitals: [] })),
          getAllAppointmentsForAdminApi(token).catch(() => ({ appointments: [] })),
          getSpecializations().catch(() => ({ specializations: [] })),
          getAllHospitalDoctorsForAdminApi(token).catch(() => ({ relationships: [] })),
          getHospitalDoctorHistoryApi(token).catch(() => ({ history: [] })),
          getPaymentsApi({}, token).catch(() => ({ payments: [] })),
        ])

        const pList = patientsData.patients || []
        const dList = doctorsData.doctors || []
        const hList = hospitalsData.hospitals || []
        const aList = apptsData.appointments || []
        const sList = specsData.specializations || []
        const hdList = hospitalDocsData.relationships || []
        const histList = historyData.history || []
        const payList = (paymentsData as any)?.payments || []

        setPatients(pList)
        setDoctors(dList)
        setHospitals(hList)
        setAllAppointments(aList)
        setSpecializationsList(sList)
        setHospitalDoctors(hdList)
        setHospitalDoctorHistory(histList)
        setAdminPayments(payList)

        const pendingJoinReqs = hdList.filter((r) => r.status === 'PENDING').length

        // Fallback / sync stats if backend dashboard endpoint returned default
        setStats((prev) => ({
          totalPatients: pList.length || prev.totalPatients,
          totalDoctors: dList.length || prev.totalDoctors,
          totalHospitals: hList.length || prev.totalHospitals,
          totalAppointments: aList.length || prev.totalAppointments,
          pendingDoctorApprovals: dList.filter((d) => d.verificationStatus === 'pending').length || prev.pendingDoctorApprovals,
          pendingDoctorJoinRequests: pendingJoinReqs,
          todayAppointments: prev.todayAppointments || Math.min(aList.length, 3),
        }))

        if (!dashData?.recentAppointments?.length && aList.length) {
          setRecentAppointments(aList.slice(0, 6))
        }
        if (!dashData?.pendingDoctors?.length && dList.length) {
          setPendingDoctors(dList.filter((d) => d.verificationStatus === 'pending').slice(0, 6))
        }

        // Real appointment overview from actual appointments
        if (!dashData?.appointmentsOverview) {
          const dayMap: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          aList.forEach((a) => {
            const rawDate = a.appointmentDate || a.createdAt
            if (rawDate) {
              const dt = new Date(rawDate)
              if (!isNaN(dt.getTime())) {
                const dName = days[dt.getDay()]
                if (dName && dayMap[dName] !== undefined) {
                  dayMap[dName]++
                }
              }
            }
          })
          const realDaily = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => ({
            label,
            date: '',
            count: dayMap[label] || 0,
          }))
          const totalApptCount = aList.length
          setAppointmentsOverview({
            daily: realDaily,
            weekly: [
              { label: 'Week 1', count: aList.slice(0, Math.ceil(totalApptCount / 4)).length },
              { label: 'Week 2', count: aList.slice(Math.ceil(totalApptCount / 4), Math.ceil(totalApptCount / 2)).length },
              { label: 'Week 3', count: aList.slice(Math.ceil(totalApptCount / 2), Math.ceil((totalApptCount * 3) / 4)).length },
              { label: 'Week 4', count: aList.slice(Math.ceil((totalApptCount * 3) / 4)).length },
            ],
            monthly: [
              { label: 'Active Total', count: totalApptCount },
            ],
          })
        }

        if (!dashData?.userGrowth) {
          setUserGrowth([
            {
              month: 'Current Active',
              patients: pList.length,
              doctors: dList.length,
            },
          ])
        }
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Error loading admin data.'))
      } finally {
        setLoading(false)
      }
    }

    void loadAllAdminData()
  }, [navigate, token])

  // Paginated Fetchers for Admin Modules
  const fetchAdminPatients = async (targetPage = patientPage, targetSearch = patientSearch) => {
    if (!token) return
    setPatientLoading(true)
    try {
      const res = await getAllPatientsForAdmin(token, {
        page: targetPage,
        limit: 10,
        search: targetSearch.trim() || undefined,
      })
      setPatients(res.patients || res.data || [])
      setPatientTotalPages(res.totalPages || 1)
      setPatientTotalItems(res.totalItems || (res.patients || []).length)
      setPatientPage(res.currentPage || targetPage)
    } catch (err) {
      console.warn('Failed to load paginated patients:', err)
    } finally {
      setPatientLoading(false)
    }
  }

  const fetchAdminDoctors = async (
    targetPage = doctorPage,
    targetSearch = doctorSearch,
    targetStatus = doctorStatusFilter
  ) => {
    if (!token) return
    setDoctorLoading(true)
    try {
      const res = await getAllDoctorsForAdmin(token, {
        page: targetPage,
        limit: 10,
        search: targetSearch.trim() || undefined,
        status: targetStatus === 'all' ? undefined : targetStatus,
      })
      setDoctors(res.doctors || res.data || [])
      setDoctorTotalPages(res.totalPages || 1)
      setDoctorTotalItems(res.totalItems || (res.doctors || []).length)
      setDoctorPage(res.currentPage || targetPage)
    } catch (err) {
      console.warn('Failed to load paginated doctors:', err)
    } finally {
      setDoctorLoading(false)
    }
  }

  const fetchAdminAppointments = async (targetPage = apptPage, targetStatus = apptStatusFilter) => {
    if (!token) return
    setApptLoading(true)
    try {
      const res = await getAllAppointmentsForAdminApi(token, {
        page: targetPage,
        limit: 10,
        status: targetStatus === 'all' ? undefined : targetStatus,
      })
      setAllAppointments(res.appointments || res.data || [])
      setApptTotalPages(res.totalPages || 1)
      setApptTotalItems(res.totalItems || (res.appointments || []).length)
      setApptPage(res.currentPage || targetPage)
    } catch (err) {
      console.warn('Failed to load paginated appointments:', err)
    } finally {
      setApptLoading(false)
    }
  }

  // Fetch booked slots and doctor's added slots for admin reschedule modal
  const fetchDoctorSlotsForAdminReschedule = async (
    doctorId: string,
    dateStr: string,
    initialDoctorSlots?: string[],
  ) => {
    if (!doctorId || !dateStr) return
    setAdminRescheduleLoadingSlots(true)
    setAdminRescheduleError(null)
    try {
      const res = await getDoctorBookedSlotsApi(doctorId, { date: dateStr }, token)
      setAdminRescheduleBookedSlots(res.bookedSlots || [])
      if (res.availableSlots && res.availableSlots.length > 0) {
        setAdminRescheduleDoctorSlots(res.availableSlots)
      } else if (initialDoctorSlots && initialDoctorSlots.length > 0) {
        setAdminRescheduleDoctorSlots(initialDoctorSlots)
      } else {
        try {
          const docData = await getDoctorByIdForAdmin(doctorId, token)
          const doc = (docData as any).doctor || docData
          if (doc?.availability?.availableSlots?.length) {
            setAdminRescheduleDoctorSlots(doc.availability.availableSlots)
          } else {
            setAdminRescheduleDoctorSlots(['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'])
          }
        } catch {
          setAdminRescheduleDoctorSlots(['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'])
        }
      }
    } catch (err) {
      console.warn('Failed to load doctor booked slots:', err)
      if (initialDoctorSlots && initialDoctorSlots.length > 0) {
        setAdminRescheduleDoctorSlots(initialDoctorSlots)
      }
    } finally {
      setAdminRescheduleLoadingSlots(false)
    }
  }

  // Open Admin Reschedule Modal
  const handleOpenAdminReschedule = (appt: AppointmentItem) => {
    setAdminRescheduleAppt(appt)
    setAdminRescheduleError(null)
    setAdminRescheduleReason('')
    setAdminRescheduleTimeSlot(appt.timeSlot || '')

    const docObj = appt.doctor as any
    const docSlots = docObj?.availability?.availableSlots || []
    setAdminRescheduleDoctorSlots(docSlots)

    const targetDate = appt.appointmentDate
      ? new Date(appt.appointmentDate).toISOString().split('T')[0]
      : (() => {
          const d = new Date()
          d.setDate(d.getDate() + 1)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })()

    setAdminRescheduleDate(targetDate)
    const docId = (appt.doctor as any)?._id || (typeof appt.doctor === 'string' ? appt.doctor : '')
    if (docId) {
      fetchDoctorSlotsForAdminReschedule(docId, targetDate, docSlots)
    }
  }

  // Submit Admin Reschedule (Immediate)
  const handleSubmitAdminReschedule = async () => {
    if (!adminRescheduleAppt?._id || !token) return
    if (!adminRescheduleDate) {
      setAdminRescheduleError('Please select a valid reschedule date.')
      return
    }
    if (!adminRescheduleTimeSlot) {
      setAdminRescheduleError('Please select a valid time slot.')
      return
    }

    // Check that selected slot is in doctor's added time slots
    if (
      adminRescheduleDoctorSlots.length > 0 &&
      !adminRescheduleDoctorSlots.some(
        (s) => s.trim().toLowerCase() === adminRescheduleTimeSlot.trim().toLowerCase(),
      )
    ) {
      setAdminRescheduleError(
        `Selected slot "${adminRescheduleTimeSlot}" is not in the doctor's added time slots. Please select from: ${adminRescheduleDoctorSlots.join(', ')}.`,
      )
      return
    }

    setAdminRescheduleSubmitting(true)
    setAdminRescheduleError(null)

    try {
      const res = await adminRescheduleAppointmentApi(
        adminRescheduleAppt._id,
        {
          newDate: adminRescheduleDate,
          newTimeSlot: adminRescheduleTimeSlot,
          reason: adminRescheduleReason.trim() || 'Administrative reschedule',
        },
        token,
      )

      if (res.appointment) {
        const updated = res.appointment
        setAllAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
        setRecentAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
      } else {
        setAllAppointments((prev) =>
          prev.map((a) =>
            a._id === adminRescheduleAppt._id
              ? {
                  ...a,
                  appointmentDate: adminRescheduleDate,
                  timeSlot: adminRescheduleTimeSlot,
                  rescheduleRequest: { status: 'none', approvalStatus: 'not_required' },
                }
              : a,
          ),
        )
      }

      setSuccessMsg('Appointment rescheduled successfully. The new date and time took effect immediately and parties were notified.')
      setAdminRescheduleAppt(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setAdminRescheduleError(err instanceof Error ? err.message : 'Failed to reschedule appointment')
    } finally {
      setAdminRescheduleSubmitting(false)
    }
  }

  // Open Admin Cancel Modal
  const handleOpenAdminCancel = (appt: AppointmentItem) => {
    setAdminCancelAppt(appt)
    setAdminCancelError(null)
    setAdminCancelReason('')
  }

  // Submit Admin Cancel (Immediate)
  const handleSubmitAdminCancel = async () => {
    if (!adminCancelAppt?._id || !token) return
    setAdminCancelSubmitting(true)
    setAdminCancelError(null)

    try {
      const res = await adminCancelAppointmentApi(
        adminCancelAppt._id,
        {
          reason: adminCancelReason.trim() || 'Administrative cancellation',
        },
        token,
      )

      const updated = res.appointment
      if (updated) {
        setAllAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
        setRecentAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
      } else {
        setAllAppointments((prev) =>
          prev.map((a) => (a._id === adminCancelAppt._id ? { ...a, status: 'cancelled' } : a)),
        )
        setRecentAppointments((prev) =>
          prev.map((a) => (a._id === adminCancelAppt._id ? { ...a, status: 'cancelled' } : a)),
        )
      }

      setSuccessMsg('Appointment cancelled successfully by Administrator. The patient and doctor were notified.')
      setAdminCancelAppt(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setAdminCancelError(err instanceof Error ? err.message : 'Failed to cancel appointment')
    } finally {
      setAdminCancelSubmitting(false)
    }
  }

  const fetchAdminHospitals = async (targetPage = hospitalPage, targetSearch = hospitalSearch) => {
    if (!token) return
    setHospitalLoading(true)
    try {
      const res = await getAllHospitalsForAdmin(token, {
        page: targetPage,
        limit: 10,
        search: targetSearch.trim() || undefined,
      })
      setHospitals(res.hospitals || res.data || [])
      setHospitalTotalPages(res.totalPages || 1)
      setHospitalTotalItems(res.totalItems || (res.hospitals || []).length)
      setHospitalPage(res.currentPage || targetPage)
    } catch (err) {
      console.warn('Failed to load paginated hospitals:', err)
    } finally {
      setHospitalLoading(false)
    }
  }

  const fetchAdminPayments = async (targetPage = adminPaymentPage, targetStatus = paymentStatusFilter) => {
    if (!token) return
    setAdminPaymentLoading(true)
    try {
      const res = await getPaymentsApi(
        {
          page: targetPage,
          limit: 10,
          status: targetStatus === 'all' ? undefined : targetStatus,
        },
        token
      )
      setAdminPayments(res.payments || res.data || [])
      setAdminPaymentTotalPages(res.totalPages || 1)
      setAdminPaymentTotalItems(res.totalItems || (res.payments || []).length)
      setAdminPaymentPage(res.currentPage || targetPage)
    } catch (err) {
      console.warn('Failed to load paginated payments:', err)
    } finally {
      setAdminPaymentLoading(false)
    }
  }

  // Reactive Module Fetches when Tab or Filters Change
  useEffect(() => {
    if (activeSection === 'patients') {
      const timer = setTimeout(() => {
        setPatientPage(1)
        fetchAdminPatients(1, patientSearch)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [patientSearch, activeSection])

  useEffect(() => {
    if (activeSection === 'doctors') {
      const timer = setTimeout(() => {
        setDoctorPage(1)
        fetchAdminDoctors(1, doctorSearch, doctorStatusFilter)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [doctorSearch, doctorStatusFilter, activeSection])

  useEffect(() => {
    if (activeSection === 'appointments') {
      setApptPage(1)
      fetchAdminAppointments(1, apptStatusFilter)
    }
  }, [apptStatusFilter, activeSection])

  useEffect(() => {
    if (activeSection === 'hospitals' && hospitalTab === 'directory') {
      const timer = setTimeout(() => {
        setHospitalPage(1)
        fetchAdminHospitals(1, hospitalSearch)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [hospitalSearch, activeSection, hospitalTab])

  useEffect(() => {
    if (activeSection === 'payments') {
      setAdminPaymentPage(1)
      fetchAdminPayments(1, paymentStatusFilter)
    }
  }, [paymentStatusFilter, activeSection])

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
        .catch((err) => setError(getFriendlyErrorMessage(err, 'Failed to load patient details.')))
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
        .catch((err) => setError(getFriendlyErrorMessage(err, 'Failed to load doctor details.')))
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
      setError(getFriendlyErrorMessage(err, 'Unable to verify doctor.'))
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
      setError(getFriendlyErrorMessage(err, 'Unable to reject doctor.'))
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
      const deptList = hospitalCreateForm.departments
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)

      const payload = {
        name: hospitalCreateForm.name.trim(),
        licenseNumber: hospitalCreateForm.licenseNumber.trim(),
        address: {
          street: hospitalCreateForm.street.trim(),
          city: hospitalCreateForm.city.trim(),
          state: hospitalCreateForm.state.trim(),
        },
        contactInfo: {
          phone: hospitalCreateForm.phone.trim(),
          email: hospitalCreateForm.email.trim(),
          website: hospitalCreateForm.website.trim(),
        },
        departments: deptList.length > 0 ? deptList : ['General Medicine'],
        isActive: hospitalCreateForm.isActive,
        verificationStatus: hospitalCreateForm.verificationStatus,
      }

      const data = await createHospitalForAdmin(payload, token)
      if (data.hospital) {
        setHospitals((prev) => [data.hospital as Hospital, ...prev])
        setStats((prev) => ({ ...prev, totalHospitals: prev.totalHospitals + 1 }))
      }
      setHospitalCreateForm({
        name: '',
        licenseNumber: '',
        street: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        website: '',
        departments: 'General Medicine, Cardiology, Pediatrics, Orthopedics, Emergency',
        isActive: true,
        verificationStatus: 'verified',
      })
      setShowHospitalForm(false)
      setSuccessMsg('Hospital center created successfully.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to create hospital.'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateHospital = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !editingHospital?._id) return
    try {
      setSaving(true)
      const data = await updateHospitalByIdForAdmin(editingHospital._id, editingHospital, token)
      if (data.hospital) {
        setHospitals((prev) =>
          prev.map((h) => (h._id === editingHospital._id ? (data.hospital as Hospital) : h))
        )
      }
      setEditingHospital(null)
      setSuccessMsg('Hospital details updated successfully.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to update hospital.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleHospitalActive = async (id: string, currentActive: boolean) => {
    if (!token) return
    try {
      setSaving(true)
      const res = await toggleHospitalStatusApi(id, token)
      const nextActive = res.hospital?.isActive ?? !currentActive
      setHospitals((prev) =>
        prev.map((h) => (h._id === id ? { ...h, isActive: nextActive } : h))
      )
      setSuccessMsg(`Hospital ${nextActive ? 'activated' : 'deactivated'} successfully.`)
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to update hospital status.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleHospitalVerify = async (id: string, currentStatus?: string) => {
    if (!token) return
    const nextStatus = currentStatus === 'verified' ? 'pending' : 'verified'
    try {
      setSaving(true)
      await verifyHospitalApi(id, nextStatus, token)
      setHospitals((prev) =>
        prev.map((h) => (h._id === id ? { ...h, verificationStatus: nextStatus as any } : h))
      )
      setSuccessMsg(`Hospital verification updated to ${nextStatus}.`)
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to update hospital verification.'))
    } finally {
      setSaving(false)
    }
  }

  // Doctor-Hospital Relationship Actions (Main Admin)
  const handleApproveDoctorRequest = async (requestId: string) => {
    if (!token) return
    try {
      setSaving(true)
      const res = await approveDoctorHospitalRequestApi(requestId, token)
      if (res.relationship) {
        setHospitalDoctors((prev) =>
          prev.map((r) => (r._id === requestId ? (res.relationship as HospitalDoctorItem) : r))
        )
        getHospitalDoctorHistoryApi(token).then((h) => setHospitalDoctorHistory(h.history || []))
        getAllHospitalsForAdmin(token).then((h) => setHospitals(h.hospitals || []))
        setStats((prev) => ({
          ...prev,
          pendingDoctorJoinRequests: Math.max(0, (prev.pendingDoctorJoinRequests || 1) - 1),
        }))
      }
      setSuccessMsg('Doctor join request approved! Relationship is now ACTIVE.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to approve request.'))
    } finally {
      setSaving(false)
    }
  }

  const handleRejectDoctorRequest = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !rejectingRequest?._id) return
    try {
      setSaving(true)
      const res = await rejectDoctorHospitalRequestApi(rejectingRequest._id, rejectReason, token)
      if (res.relationship) {
        setHospitalDoctors((prev) =>
          prev.map((r) => (r._id === rejectingRequest._id ? (res.relationship as HospitalDoctorItem) : r))
        )
        getHospitalDoctorHistoryApi(token).then((h) => setHospitalDoctorHistory(h.history || []))
        setStats((prev) => ({
          ...prev,
          pendingDoctorJoinRequests: Math.max(0, (prev.pendingDoctorJoinRequests || 1) - 1),
        }))
      }
      setRejectingRequest(null)
      setRejectReason('')
      setSuccessMsg('Doctor request has been rejected.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to reject request.'))
    } finally {
      setSaving(false)
    }
  }

  const handleAssociateDoctor = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !assocForm.doctorId || !assocForm.hospitalId) return
    try {
      setSaving(true)
      const res = await associateDoctorWithHospitalApi(assocForm, token)
      if (res.relationship) {
        setHospitalDoctors((prev) => {
          const exists = prev.some((r) => r._id === res.relationship?._id)
          return exists
            ? prev.map((r) => (r._id === res.relationship?._id ? (res.relationship as HospitalDoctorItem) : r))
            : [res.relationship as HospitalDoctorItem, ...prev]
        })
        getHospitalDoctorHistoryApi(token).then((h) => setHospitalDoctorHistory(h.history || []))
        getAllHospitalsForAdmin(token).then((h) => setHospitals(h.hospitals || []))
      }
      setShowAssociateModal(false)
      setAssocForm({ doctorId: '', hospitalId: '', department: '' })
      setSuccessMsg('Doctor successfully associated with the hospital.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to associate doctor.'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveDoctorFromHospital = async (relationshipId: string) => {
    if (!token) return
    if (!window.confirm('Are you sure you want to remove/deactivate this Doctor-Hospital affiliation?')) return
    try {
      setSaving(true)
      const res = await removeDoctorFromHospitalApi(relationshipId, token)
      if (res.relationship) {
        setHospitalDoctors((prev) =>
          prev.map((r) => (r._id === relationshipId ? (res.relationship as HospitalDoctorItem) : r))
        )
        getHospitalDoctorHistoryApi(token).then((h) => setHospitalDoctorHistory(h.history || []))
        getAllHospitalsForAdmin(token).then((h) => setHospitals(h.hospitals || []))
      }
      setSuccessMsg('Doctor affiliation removed from hospital.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to remove doctor affiliation.'))
    } finally {
      setSaving(false)
    }
  }

  // Navigation handler
  const handleNavClick = (section: NavSection) => {
    setSidebarOpen(false)
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
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Admin Navigation Sidebar">
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
              {complaintsList.filter((c) => c.status !== 'Resolved').length > 0 && (
                <span className="admin-nav-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {complaintsList.filter((c) => c.status !== 'Resolved').length}
                </span>
              )}
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

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ========================================================
          2. MAIN CONTENT VIEWPORT
          ======================================================== */}
      <div className="admin-main-viewport">
        {/* Top Header Bar */}
        <header className="admin-top-header">
          <div className="admin-header-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
            >
              {sidebarOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
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
                        <div className="admin-growth-card-lbl">Total Patients</div>
                      </div>
                      <div className="admin-growth-card">
                        <span className="admin-growth-card-val" style={{ color: '#0d5c63' }}>
                          {stats.totalDoctors}
                        </span>
                        <div className="admin-growth-card-lbl">Total Doctors</div>
                      </div>
                    </div>

                    <div className="admin-growth-timeline">
                      {userGrowth.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '0.84rem' }}>
                          Network Directory: <strong>{stats.totalPatients}</strong> Patients and <strong>{stats.totalDoctors}</strong> Doctors registered.
                        </div>
                      ) : (
                        userGrowth.slice(-4).map((ug, idx) => {
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
                        })
                      )}
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
                    {complaints.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                        No complaints reported.
                      </p>
                    ) : (
                      complaints.map((cmp) => (
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
                      ))
                    )}
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

              <div className="admin-table-scroll">
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
                    {(() => {
                      const filteredPatients = patients.filter((p) => {
                        const query = patientSearch.toLowerCase().trim()
                        if (!query) return true
                        return (
                          p.user?.name?.toLowerCase().includes(query) ||
                          p.user?.email?.toLowerCase().includes(query) ||
                          p.phone?.toLowerCase().includes(query)
                        )
                      })

                      if (filteredPatients.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <UsersIcon size={32} style={{ color: '#94a3b8' }} />
                                <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>No patients found</strong>
                                <span style={{ fontSize: '0.84rem' }}>
                                  {patientSearch ? `No records matching "${patientSearch}"` : 'No registered patients in database yet.'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return filteredPatients.map((p) => (
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
                      ))
                    })()}
                  </tbody>
                </table>
              </div>

              {patientTotalPages > 1 && !patientLoading && (
                <div style={{ marginTop: '20px' }}>
                  <Pagination
                    currentPage={patientPage}
                    totalPages={patientTotalPages}
                    totalItems={patientTotalItems}
                    itemsPerPage={10}
                    onPageChange={(p) => {
                      setPatientPage(p)
                      fetchAdminPatients(p, patientSearch)
                    }}
                    loading={patientLoading}
                  />
                </div>
              )}
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

              <div className="admin-table-scroll">
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
                    {(() => {
                      const filteredDoctors = doctors.filter((d) => {
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

                      if (filteredDoctors.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <StethoscopeIcon size={32} style={{ color: '#94a3b8' }} />
                                <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>No doctors found</strong>
                                <span style={{ fontSize: '0.84rem' }}>
                                  {doctorSearch
                                    ? `No doctors matching "${doctorSearch}"`
                                    : doctorStatusFilter !== 'all'
                                    ? `No doctors with status "${doctorStatusFilter}"`
                                    : 'No registered practitioners yet.'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return filteredDoctors.map((d) => (
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
                                    disabled={saving}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn-reject"
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                    onClick={() => handleRejectDoctor(d._id || '')}
                                    disabled={saving}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-tf-tab"
                                  disabled={saving}
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
                      ))
                    })()}
                  </tbody>
                </table>
              </div>

              {doctorTotalPages > 1 && !doctorLoading && (
                <div style={{ marginTop: '20px' }}>
                  <Pagination
                    currentPage={doctorPage}
                    totalPages={doctorTotalPages}
                    totalItems={doctorTotalItems}
                    itemsPerPage={10}
                    onPageChange={(p) => {
                      setDoctorPage(p)
                      fetchAdminDoctors(p, doctorSearch, doctorStatusFilter)
                    }}
                    loading={doctorLoading}
                  />
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              MODULE 3: HOSPITALS & DOCTOR AFFILIATIONS MANAGEMENT (MAIN ADMIN)
              ======================================================== */}
          {activeSection === 'hospitals' && (
            <div className="admin-module-card">
              <div className="admin-module-header">
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HospitalIcon size={24} style={{ color: 'var(--admin-primary)' }} />
                    Hospitals & Doctor Affiliations
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Main Admin Organization Management, Doctor Join Requests, and Affiliation Lifecycle
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {hospitalTab === 'directory' && (
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={() => setShowHospitalForm((prev) => !prev)}
                    >
                      {showHospitalForm ? '✕ Close Form' : '+ Add Hospital'}
                    </button>
                  )}
                  {hospitalTab === 'associations' && (
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={() => setShowAssociateModal(true)}
                    >
                      + Associate Doctor Directly
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="admin-subnav-tabs">
                <button
                  type="button"
                  className={`admin-subnav-tab ${hospitalTab === 'directory' ? 'active' : ''}`}
                  onClick={() => setHospitalTab('directory')}
                >
                  <HospitalIcon size={16} />
                  <span>Hospital Organizations</span>
                  <span className="admin-badge-count">{hospitals.length}</span>
                </button>

                <button
                  type="button"
                  className={`admin-subnav-tab ${hospitalTab === 'requests' ? 'active' : ''}`}
                  onClick={() => setHospitalTab('requests')}
                >
                  <ClockIcon size={16} />
                  <span>Doctor Join Requests</span>
                  {hospitalDoctors.filter((r) => r.status === 'PENDING').length > 0 ? (
                    <span className="admin-badge-count alert">
                      {hospitalDoctors.filter((r) => r.status === 'PENDING').length} Pending
                    </span>
                  ) : (
                    <span className="admin-badge-count">0</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`admin-subnav-tab ${hospitalTab === 'associations' ? 'active' : ''}`}
                  onClick={() => setHospitalTab('associations')}
                >
                  <UsersIcon size={16} />
                  <span>Active Associations</span>
                  <span className="admin-badge-count active">
                    {hospitalDoctors.filter((r) => r.status === 'ACTIVE').length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`admin-subnav-tab ${hospitalTab === 'history' ? 'active' : ''}`}
                  onClick={() => setHospitalTab('history')}
                >
                  <TrendingUpIcon size={16} />
                  <span>Affiliation History</span>
                  <span className="admin-badge-count">{hospitalDoctorHistory.length}</span>
                </button>
              </div>

              {/* ----------------------------------------------------
                  SUBTAB 1: HOSPITAL DIRECTORY
                  ---------------------------------------------------- */}
              {hospitalTab === 'directory' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div className="admin-timeframe-tabs">
                      {(['all', 'active', 'inactive', 'verified'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`admin-tf-tab ${hospitalFilterStatus === st ? 'active' : ''}`}
                          onClick={() => setHospitalFilterStatus(st)}
                        >
                          {st === 'all' ? 'All Centers' : st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="admin-search-bar" style={{ width: '260px' }}>
                      <SearchIcon size={16} />
                      <input
                        type="text"
                        placeholder="Search by name, city, department..."
                        value={hospitalSearch}
                        onChange={(e) => setHospitalSearch(e.target.value)}
                        className="admin-search-input"
                      />
                    </div>
                  </div>

                  {/* Add Hospital Form */}
                  {showHospitalForm && (
                    <form
                      onSubmit={handleCreateHospital}
                      style={{
                        background: '#f8fafc',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--admin-border)',
                        marginBottom: '20px',
                      }}
                    >
                      <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800 }}>
                        Add New Hospital Organization
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Hospital Name *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Apollo Multi-Speciality Hospital"
                            value={hospitalCreateForm.name}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, name: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Registration / License Number
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. REG-HOSP-2026-88"
                            value={hospitalCreateForm.licenseNumber}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, licenseNumber: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            City
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Bangalore"
                            value={hospitalCreateForm.city}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, city: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Street Address
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 15 Bannerghatta Road"
                            value={hospitalCreateForm.street}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, street: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. +91 80 2630 4050"
                            value={hospitalCreateForm.phone}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, phone: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Contact Email
                          </label>
                          <input
                            type="email"
                            placeholder="e.g. info@apollo.example.com"
                            value={hospitalCreateForm.email}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, email: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Clinical Departments (comma-separated)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. General Medicine, Cardiology, Pediatrics, Orthopedics, Neurology, Emergency"
                          value={hospitalCreateForm.departments}
                          onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, departments: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={hospitalCreateForm.isActive}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, isActive: e.target.checked })}
                          />
                          Active Network Center
                        </label>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>Verification:</span>
                          <select
                            value={hospitalCreateForm.verificationStatus}
                            onChange={(e) => setHospitalCreateForm({ ...hospitalCreateForm, verificationStatus: e.target.value })}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="verified">Verified</option>
                            <option value="pending">Pending</option>
                            <option value="unverified">Unverified</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className="admin-btn-primary" disabled={saving}>
                          {saving ? 'Creating...' : 'Create Hospital Organization'}
                        </button>
                        <button
                          type="button"
                          className="admin-tf-tab"
                          onClick={() => setShowHospitalForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Edit Hospital Form */}
                  {editingHospital && (
                    <form
                      onSubmit={handleUpdateHospital}
                      style={{
                        background: '#f8fafc',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid var(--admin-primary)',
                        marginBottom: '20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                          Edit Hospital: {editingHospital.name}
                        </h3>
                        <button
                          type="button"
                          className="admin-tf-tab"
                          onClick={() => setEditingHospital(null)}
                        >
                          Cancel
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Hospital Name
                          </label>
                          <input
                            type="text"
                            value={editingHospital.name || ''}
                            onChange={(e) => setEditingHospital({ ...editingHospital, name: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            License / Registration
                          </label>
                          <input
                            type="text"
                            value={editingHospital.licenseNumber || ''}
                            onChange={(e) => setEditingHospital({ ...editingHospital, licenseNumber: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            City
                          </label>
                          <input
                            type="text"
                            value={editingHospital.address?.city || ''}
                            onChange={(e) =>
                              setEditingHospital({
                                ...editingHospital,
                                address: { ...editingHospital.address, city: e.target.value },
                              })
                            }
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Phone
                          </label>
                          <input
                            type="text"
                            value={editingHospital.contactInfo?.phone || ''}
                            onChange={(e) =>
                              setEditingHospital({
                                ...editingHospital,
                                contactInfo: { ...editingHospital.contactInfo, phone: e.target.value },
                              })
                            }
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Departments (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={(editingHospital.departments || []).join(', ')}
                          onChange={(e) =>
                            setEditingHospital({
                              ...editingHospital,
                              departments: e.target.value.split(',').map((d) => d.trim()).filter(Boolean),
                            })
                          }
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(editingHospital.isActive)}
                            onChange={(e) => setEditingHospital({ ...editingHospital, isActive: e.target.checked })}
                          />
                          Active Center
                        </label>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>Verification:</span>
                          <select
                            value={editingHospital.verificationStatus || 'verified'}
                            onChange={(e) => setEditingHospital({ ...editingHospital, verificationStatus: e.target.value as any })}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="verified">Verified</option>
                            <option value="pending">Pending</option>
                            <option value="unverified">Unverified</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className="admin-btn-primary" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Hospital Changes'}
                        </button>
                        <button
                          type="button"
                          className="admin-tf-tab"
                          onClick={() => setEditingHospital(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Hospital Table */}
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Hospital Center</th>
                        <th>Departments</th>
                        <th>Affiliated Practitioners</th>
                        <th>Verification</th>
                        <th>Network Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitals
                        .filter((h) => {
                          const q = hospitalSearch.toLowerCase().trim()
                          const matchesQuery = !q ||
                            (h.name || '').toLowerCase().includes(q) ||
                            (h.address?.city || '').toLowerCase().includes(q) ||
                            (h.departments || []).some((d) => d.toLowerCase().includes(q))

                          if (!matchesQuery) return false

                          if (hospitalFilterStatus === 'active') return h.isActive === true
                          if (hospitalFilterStatus === 'inactive') return h.isActive === false
                          if (hospitalFilterStatus === 'verified') return h.verificationStatus === 'verified'
                          return true
                        })
                        .map((h) => {
                          const activeDocsForHosp = hospitalDoctors.filter(
                            (r) => r.hospital && ((r.hospital as any)._id === h._id || (r.hospital as any) === h._id) && r.status === 'ACTIVE'
                          )
                          const docCount = activeDocsForHosp.length || h.activeDoctorsCount || 0
                          const isVerified = h.verificationStatus === 'verified'

                          return (
                            <tr key={h._id}>
                              <td>
                                <div>
                                  <strong style={{ fontSize: '0.94rem' }}>{h.name}</strong>
                                  {h.licenseNumber && (
                                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                                      License: {h.licenseNumber}
                                    </span>
                                  )}
                                  {h.address?.city && (
                                    <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>
                                      📍 {h.address.city}{h.address.state ? `, ${h.address.state}` : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '240px' }}>
                                  {(h.departments && h.departments.length > 0 ? h.departments : ['General Medicine']).slice(0, 3).map((dept) => (
                                    <span key={dept} className="admin-dept-tag">
                                      {dept}
                                    </span>
                                  ))}
                                  {h.departments && h.departments.length > 3 && (
                                    <span className="admin-dept-tag" style={{ background: '#e2e8f0' }}>
                                      +{h.departments.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => setViewingHospitalDetails(h)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                  title="View affiliated practitioners"
                                >
                                  <span style={{ fontWeight: 700, color: 'var(--admin-primary)', textDecoration: 'underline' }}>
                                    {docCount}
                                  </span>{' '}
                                  practitioner{docCount !== 1 ? 's' : ''}
                                </button>
                              </td>
                              <td>
                                <span
                                  className="admin-severity-pill"
                                  style={{
                                    background: isVerified ? '#d1fae5' : '#fef3c7',
                                    color: isVerified ? '#065f46' : '#b45309',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  {isVerified ? <ShieldCheckIcon size={12} /> : <AlertCircleIcon size={12} />}
                                  {isVerified ? 'Verified' : 'Pending Verification'}
                                </span>
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
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="admin-tf-tab"
                                    onClick={() => setEditingHospital(h)}
                                    title="Edit hospital details"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-tf-tab"
                                    onClick={() => handleToggleHospitalVerify(h._id || '', h.verificationStatus)}
                                    title={isVerified ? 'Unverify' : 'Verify'}
                                  >
                                    {isVerified ? 'Unverify' : 'Verify'}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-tf-tab"
                                    onClick={() => handleToggleHospitalActive(h._id || '', Boolean(h.isActive))}
                                    title={h.isActive ? 'Deactivate' : 'Activate'}
                                  >
                                    {h.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      {hospitals.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                            No hospitals registered yet. Click <strong>+ Add Hospital</strong> to register the first organization.
                          </td>
                        </tr>
                      )}
                      {hospitals.length > 0 &&
                        hospitals.filter((h) => {
                          const q = hospitalSearch.toLowerCase().trim()
                          const matchesQuery = !q ||
                            (h.name || '').toLowerCase().includes(q) ||
                            (h.address?.city || '').toLowerCase().includes(q) ||
                            (h.departments || []).some((d) => d.toLowerCase().includes(q))
                          if (!matchesQuery) return false
                          if (hospitalFilterStatus === 'active') return h.isActive === true
                          if (hospitalFilterStatus === 'inactive') return h.isActive === false
                          if (hospitalFilterStatus === 'verified') return h.verificationStatus === 'verified'
                          return true
                        }).length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                              No hospitals found matching "{hospitalSearch || hospitalFilterStatus}".
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                  </div>

                  {hospitalTotalPages > 1 && !hospitalLoading && (
                    <div style={{ marginTop: '20px' }}>
                      <Pagination
                        currentPage={hospitalPage}
                        totalPages={hospitalTotalPages}
                        totalItems={hospitalTotalItems}
                        itemsPerPage={10}
                        onPageChange={(p) => {
                          setHospitalPage(p)
                          fetchAdminHospitals(p, hospitalSearch)
                        }}
                        loading={hospitalLoading}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------
                  SUBTAB 2: DOCTOR JOIN REQUESTS (PENDING APPROVALS)
                  ---------------------------------------------------- */}
              {hospitalTab === 'requests' && (
                <div>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                        Doctor Hospital Join Requests
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Doctors submit join requests which require Main Admin review before becoming active.
                      </span>
                    </div>
                  </div>

                  <div className="admin-table-scroll">
                    <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Requested Hospital</th>
                        <th>Department</th>
                        <th>Request Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitalDoctors
                        .filter((r) => r.status === 'PENDING')
                        .map((r) => {
                          const docObj = r.doctor as any
                          const hospObj = r.hospital as any
                          const docName = docObj?.user?.name || 'Dr. Practitioner'
                          const docEmail = docObj?.user?.email || ''
                          const hospName = hospObj?.name || 'Hospital'

                          return (
                            <tr key={r._id}>
                              <td>
                                <strong>{docName}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                                  {docObj?.specialization || 'Specialist'} {docEmail ? `• ${docEmail}` : ''}
                                </span>
                              </td>
                              <td>
                                <strong>{hospName}</strong>
                              </td>
                              <td>
                                <span className="admin-dept-tag">
                                  {r.department || 'General Medicine'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent'}
                                </span>
                              </td>
                              <td>
                                <span className="admin-badge-pending">
                                  <ClockIcon size={12} /> PENDING
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="admin-btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#059669' }}
                                    onClick={() => handleApproveDoctorRequest(r._id)}
                                    disabled={saving}
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-tf-tab"
                                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                                    onClick={() => {
                                      setRejectingRequest(r)
                                      setRejectReason('')
                                    }}
                                    disabled={saving}
                                  >
                                    ✕ Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}

                      {hospitalDoctors.filter((r) => r.status === 'PENDING').length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            <CheckCircleIcon size={32} style={{ color: '#059669', marginBottom: '8px' }} />
                            <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>All Caught Up!</div>
                            <div>There are no pending doctor join requests awaiting review.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------
                  SUBTAB 3: ACTIVE ASSOCIATIONS
                  ---------------------------------------------------- */}
              {hospitalTab === 'associations' && (
                <div>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                        Active Doctor–Hospital Associations
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Doctors actively practicing at affiliated hospitals. Main Admin can associate or remove relationships.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={() => setShowAssociateModal(true)}
                    >
                      + Associate Doctor Directly
                    </button>
                  </div>

                  <div className="admin-table-scroll">
                    <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Hospital</th>
                        <th>Department</th>
                        <th>Origin / Initiated By</th>
                        <th>Affiliated Since</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitalDoctors
                        .filter((r) => r.status === 'ACTIVE')
                        .map((r) => {
                          const docObj = r.doctor as any
                          const hospObj = r.hospital as any
                          const docName = docObj?.user?.name || 'Dr. Practitioner'
                          const hospName = hospObj?.name || 'Hospital'

                          return (
                            <tr key={r._id}>
                              <td>
                                <strong>{docName}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                                  {docObj?.specialization || 'Doctor'}
                                </span>
                              </td>
                              <td>
                                <strong>{hospName}</strong>
                              </td>
                              <td>
                                <span className="admin-dept-tag">
                                  {r.department || 'General Medicine'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                  {r.requestedBy === 'ADMIN' ? 'Admin Association' : 'Doctor Join Request'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  {r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : 'Active'}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-tf-tab"
                                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                                  onClick={() => handleRemoveDoctorFromHospital(r._id)}
                                  disabled={saving}
                                >
                                  Remove Affiliation
                                </button>
                              </td>
                            </tr>
                          )
                        })}

                      {hospitalDoctors.filter((r) => r.status === 'ACTIVE').length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No active Doctor-Hospital relationships established yet.
                            Click <strong>+ Associate Doctor Directly</strong> to link a doctor with a hospital.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------
                  SUBTAB 4: AFFILIATION HISTORY & AUDIT TRAIL
                  ---------------------------------------------------- */}
              {hospitalTab === 'history' && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Doctor–Hospital Affiliation Audit Trail
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Lifecycle tracking for all relationship state transitions (PENDING → ACTIVE / REJECTED / REMOVED)
                    </span>
                  </div>

                  <div className="admin-table-scroll">
                    <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Hospital</th>
                        <th>Department</th>
                        <th>Lifecycle Status</th>
                        <th>Requested By</th>
                        <th>Approved By</th>
                        <th>Date & Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(hospitalDoctorHistory.length > 0 ? hospitalDoctorHistory : hospitalDoctors).map((r) => {
                        const docObj = r.doctor as any
                        const hospObj = r.hospital as any
                        const docName = docObj?.user?.name || 'Dr. Practitioner'
                        const hospName = hospObj?.name || 'Hospital'

                        return (
                          <tr key={r._id}>
                            <td>
                              <strong>{docName}</strong>
                              <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                                {docObj?.specialization || ''}
                              </span>
                            </td>
                            <td>{hospName}</td>
                            <td>
                              <span className="admin-dept-tag">
                                {r.department || 'General Medicine'}
                              </span>
                            </td>
                            <td>
                              {r.status === 'PENDING' && (
                                <span className="admin-badge-pending">PENDING</span>
                              )}
                              {r.status === 'ACTIVE' && (
                                <span className="admin-badge-active">ACTIVE</span>
                              )}
                              {r.status === 'REJECTED' && (
                                <span className="admin-badge-rejected">REJECTED</span>
                              )}
                              {r.status === 'REMOVED' && (
                                <span className="admin-badge-removed">REMOVED</span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                {r.requestedBy}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                                {r.approvedBy ? (r.approvedBy as any).name || 'Main Admin' : '—'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                              </span>
                              {r.rejectionReason && (
                                <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '2px' }}>
                                  Reason: {r.rejectionReason}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {(hospitalDoctorHistory.length === 0 && hospitalDoctors.length === 0) && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No relationship records found in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direct Associate Doctor Modal */}
          {showAssociateModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '480px',
                  width: '100%',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Associate Doctor With Hospital
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAssociateModal(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                <form onSubmit={handleAssociateDoctor}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Select Doctor *
                    </label>
                    <select
                      value={assocForm.doctorId}
                      onChange={(e) => setAssocForm({ ...assocForm, doctorId: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      required
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map((d) => (
                        <option key={d._id} value={d._id}>
                          Dr. {d.user?.name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Select Hospital *
                    </label>
                    <select
                      value={assocForm.hospitalId}
                      onChange={(e) => setAssocForm({ ...assocForm, hospitalId: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      required
                    >
                      <option value="">-- Choose Hospital --</option>
                      {hospitals.map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name} {h.address?.city ? `(${h.address.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Department (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cardiology, Orthopedics, Pediatrics"
                      value={assocForm.department}
                      onChange={(e) => setAssocForm({ ...assocForm, department: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => setShowAssociateModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="admin-btn-primary" disabled={saving}>
                      {saving ? 'Associating...' : 'Confirm Association'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reject Join Request Modal */}
          {rejectingRequest && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '440px',
                  width: '100%',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800 }}>
                  Reject Doctor Join Request
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
                  Decline request from{' '}
                  <strong>{(rejectingRequest.doctor as any)?.user?.name || 'Practitioner'}</strong> to join{' '}
                  <strong>{(rejectingRequest.hospital as any)?.name || 'Hospital'}</strong>.
                </p>

                <form onSubmit={handleRejectDoctorRequest}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Reason for Rejection (Optional)
                    </label>
                    <textarea
                      placeholder="e.g. Department quota full, verification mismatch..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="admin-tf-tab"
                      onClick={() => setRejectingRequest(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-btn-primary"
                      style={{ background: '#dc2626' }}
                      disabled={saving}
                    >
                      {saving ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Viewing Hospital Details Modal */}
          {viewingHospitalDetails && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '560px',
                  width: '100%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    {viewingHospitalDetails.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setViewingHospitalDetails(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '4px' }}>
                    <strong>License:</strong> {viewingHospitalDetails.licenseNumber || 'Not specified'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '4px' }}>
                    <strong>Location:</strong> {viewingHospitalDetails.address?.street || ''} {viewingHospitalDetails.address?.city || ''} {viewingHospitalDetails.address?.state || ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    <strong>Contact:</strong> {viewingHospitalDetails.contactInfo?.phone || 'No phone'} • {viewingHospitalDetails.contactInfo?.email || 'No email'}
                  </div>
                </div>

                <h4 style={{ margin: '0 0 10px', fontSize: '0.96rem', fontWeight: 700 }}>
                  Associated Practitioners ({
                    hospitalDoctors.filter(
                      (r) => r.hospital && ((r.hospital as any)._id === viewingHospitalDetails._id || (r.hospital as any) === viewingHospitalDetails._id) && r.status === 'ACTIVE'
                    ).length
                  })
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {hospitalDoctors
                    .filter(
                      (r) => r.hospital && ((r.hospital as any)._id === viewingHospitalDetails._id || (r.hospital as any) === viewingHospitalDetails._id) && r.status === 'ACTIVE'
                    )
                    .map((r) => {
                      const docObj = r.doctor as any
                      return (
                        <div
                          key={r._id}
                          style={{
                            padding: '10px 14px',
                            background: '#f1f5f9',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong>Dr. {docObj?.user?.name || 'Practitioner'}</strong>
                            <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                              {docObj?.specialization} {r.department ? `• ${r.department}` : ''}
                            </span>
                          </div>
                          <span className="admin-badge-active">ACTIVE</span>
                        </div>
                      )
                    })}

                  {hospitalDoctors.filter(
                    (r) => r.hospital && ((r.hospital as any)._id === viewingHospitalDetails._id || (r.hospital as any) === viewingHospitalDetails._id) && r.status === 'ACTIVE'
                  ).length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No active practitioners associated with this hospital yet.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => setViewingHospitalDetails(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
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

              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Date & Time</th>
                      <th>Format</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredAppointments = allAppointments.filter((a) =>
                        apptStatusFilter === 'all' ? true : a.status === apptStatusFilter
                      )

                      if (filteredAppointments.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <CalendarIcon size={32} style={{ color: '#94a3b8' }} />
                                <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>No appointments found</strong>
                                <span style={{ fontSize: '0.84rem' }}>
                                  {apptStatusFilter !== 'all'
                                    ? `No appointments with status "${apptStatusFilter}"`
                                    : 'No appointments have been booked on the platform yet.'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return filteredAppointments.map((a) => (
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span className={`admin-status-pill ${a.status || 'scheduled'}`}>
                                {a.status || 'Scheduled'}
                              </span>
                              {a.rescheduleRequest?.status === 'pending' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #fde68a',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <ClockIcon size={10} />
                                  Pending Patient Approval
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {a.status !== 'completed' && a.status !== 'cancelled' ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="admin-btn-action-reschedule"
                                  onClick={() => handleOpenAdminReschedule(a)}
                                  title="Admin Reschedule (Takes effect immediately)"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-action-cancel"
                                  onClick={() => handleOpenAdminCancel(a)}
                                  title="Admin Cancel (Immediate cancellation)"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>

              {apptTotalPages > 1 && !apptLoading && (
                <div style={{ marginTop: '20px' }}>
                  <Pagination
                    currentPage={apptPage}
                    totalPages={apptTotalPages}
                    totalItems={apptTotalItems}
                    itemsPerPage={10}
                    onPageChange={(p) => {
                      setApptPage(p)
                      fetchAdminAppointments(p, apptStatusFilter)
                    }}
                    loading={apptLoading}
                  />
                </div>
              )}

              {/* Admin Reschedule Modal */}
              {adminRescheduleAppt && (
                <div
                  className="admin-modal-overlay"
                  onClick={() => !adminRescheduleSubmitting && setAdminRescheduleAppt(null)}
                >
                  <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-modal-header">
                      <div>
                        <h3>Admin Reschedule Appointment</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          Override schedule for <strong>{adminRescheduleAppt.patient?.name || 'Patient'}</strong> with{' '}
                          <strong>Dr. {adminRescheduleAppt.doctor?.user?.name || 'Doctor'}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminRescheduleAppt(null)}
                        disabled={adminRescheduleSubmitting}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      >
                        <CloseIcon size={20} />
                      </button>
                    </div>

                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        margin: '16px 0',
                        fontSize: '0.82rem',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <ShieldCheckIcon size={18} />
                      <div>
                        <strong>Administrative Authority:</strong> This reschedule takes effect <strong>immediately</strong> without requiring patient approval. Both parties will be notified automatically.
                      </div>
                    </div>

                    {adminRescheduleError && (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          marginBottom: '16px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <AlertCircleIcon size={16} />
                        <span>{adminRescheduleError}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Current Appointment
                        </label>
                        <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          {adminRescheduleAppt.appointmentDate
                            ? new Date(adminRescheduleAppt.appointmentDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}{' '}
                          at {adminRescheduleAppt.timeSlot}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Select New Date
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={adminRescheduleDate}
                          onChange={(e) => {
                            const val = e.target.value
                            setAdminRescheduleDate(val)
                            const docId = (adminRescheduleAppt.doctor as any)?._id || (typeof adminRescheduleAppt.doctor === 'string' ? adminRescheduleAppt.doctor : '')
                            if (docId && val) {
                              fetchDoctorSlotsForAdminReschedule(docId, val, adminRescheduleDoctorSlots)
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.88rem',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                            Select New Time Slot <span style={{ color: '#0d5c63' }}>(Doctor Added Slots)</span>
                          </label>
                          {adminRescheduleDoctorSlots.length > 0 && (
                            <span style={{ fontSize: '0.74rem', color: '#0d5c63', fontWeight: 600, background: '#e6f7f8', padding: '2px 8px', borderRadius: '6px' }}>
                              {adminRescheduleDoctorSlots.length} doctor slots
                            </span>
                          )}
                        </div>

                        {adminRescheduleLoadingSlots ? (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '14px 0', textAlign: 'center' }}>
                            Loading doctor's added slots...
                          </div>
                        ) : adminRescheduleDoctorSlots.length === 0 ? (
                          <div style={{ fontSize: '0.82rem', color: '#b45309', background: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                            No added time slots configured for this doctor. Please ensure doctor has configured slots.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                            {adminRescheduleDoctorSlots.map((slot) => {
                              const isBooked = adminRescheduleBookedSlots.includes(slot)
                              const isSelected = adminRescheduleTimeSlot.trim().toLowerCase() === slot.trim().toLowerCase()
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={isBooked}
                                  onClick={() => setAdminRescheduleTimeSlot(slot)}
                                  style={{
                                    padding: '9px 8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: isSelected ? '2px solid #0d5c63' : '1.5px solid #cbd5e1',
                                    background: isSelected ? '#0d5c63' : isBooked ? '#f1f5f9' : '#ffffff',
                                    color: isSelected ? '#ffffff' : isBooked ? '#94a3b8' : '#1e293b',
                                    cursor: isBooked ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={isBooked ? 'Already booked by another patient' : `Doctor added slot: ${slot}`}
                                >
                                  <span>{slot}</span>
                                  <span style={{ fontSize: '0.65rem', fontWeight: 500, color: isSelected ? '#e6f7f8' : isBooked ? '#94a3b8' : '#0d5c63' }}>
                                    {isBooked ? 'Booked' : 'Doctor Slot'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Reason for Administrative Reschedule (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={adminRescheduleReason}
                          onChange={(e) => setAdminRescheduleReason(e.target.value)}
                          placeholder="e.g. Schedule adjustment per doctor's request or platform emergency"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                      <button
                        type="button"
                        onClick={() => setAdminRescheduleAppt(null)}
                        disabled={adminRescheduleSubmitting}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitAdminReschedule}
                        disabled={adminRescheduleSubmitting || !adminRescheduleDate || !adminRescheduleTimeSlot}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#0d5c63',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: adminRescheduleSubmitting || !adminRescheduleDate || !adminRescheduleTimeSlot ? 'not-allowed' : 'pointer',
                          opacity: adminRescheduleSubmitting || !adminRescheduleDate || !adminRescheduleTimeSlot ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {adminRescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Cancel Modal */}
              {adminCancelAppt && (
                <div
                  className="admin-modal-overlay"
                  onClick={() => !adminCancelSubmitting && setAdminCancelAppt(null)}
                >
                  <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-modal-header">
                      <div>
                        <h3 style={{ color: '#991b1b' }}>Admin Cancel Appointment</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          Appointment for <strong>{adminCancelAppt.patient?.name || 'Patient'}</strong> with{' '}
                          <strong>Dr. {adminCancelAppt.doctor?.user?.name || 'Doctor'}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminCancelAppt(null)}
                        disabled={adminCancelSubmitting}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      >
                        <CloseIcon size={20} />
                      </button>
                    </div>

                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        margin: '16px 0',
                        fontSize: '0.82rem',
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertCircleIcon size={18} />
                      <div>
                        <strong>Warning:</strong> This action takes effect <strong>immediately</strong>. The appointment status will be changed to cancelled, and both the patient and doctor will be notified.
                      </div>
                    </div>

                    {adminCancelError && (
                      <div
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fda4af',
                          color: '#be123c',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          marginBottom: '16px',
                          fontSize: '0.82rem',
                        }}
                      >
                        {adminCancelError}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Appointment Schedule
                        </label>
                        <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          {adminCancelAppt.appointmentDate
                            ? new Date(adminCancelAppt.appointmentDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}{' '}
                          at {adminCancelAppt.timeSlot}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Cancellation Reason <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={adminCancelReason}
                          onChange={(e) => setAdminCancelReason(e.target.value)}
                          placeholder="Please specify why this appointment is being cancelled (e.g. Doctor emergency leave, administrative closure)..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                      <button
                        type="button"
                        onClick={() => setAdminCancelAppt(null)}
                        disabled={adminCancelSubmitting}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                        }}
                      >
                        Keep Appointment
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitAdminCancel}
                        disabled={adminCancelSubmitting || !adminCancelReason.trim()}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: adminCancelSubmitting || !adminCancelReason.trim() ? 'not-allowed' : 'pointer',
                          opacity: adminCancelSubmitting || !adminCancelReason.trim() ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {adminCancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

              {specializationsList.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <HeartPulseIcon size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#1e293b' }}>No specializations registered</h3>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                    Clinical specializations from verified doctors and hospitals will appear here.
                  </p>
                </div>
              ) : (
                <div className="admin-specs-grid">
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
              )}
            </div>
          )}

          {/* ========================================================
              MODULE SHELLS: PAYMENTS, COMPLAINTS, REPORTS
              "Build the dashboard shell first, then implement each management module one by one"
              ======================================================== */}
          {/* ========================================================
              MODULE 6: PAYMENTS MANAGEMENT (Admin Audit & Settlement)
              ======================================================== */}
          {activeSection === 'payments' && (() => {
            const filteredPayments = adminPayments.filter((p) => {
              const matchesStatus =
                paymentStatusFilter === 'all' || p.status === paymentStatusFilter
              const query = paymentSearch.toLowerCase().trim()
              if (!query) return matchesStatus

              const patientName =
                (typeof p.patientId === 'object' && p.patientId?.name) || ''
              const docName =
                (typeof p.bookingId === 'object' &&
                  (p.bookingId?.doctor as any)?.user?.name) ||
                ''
              const orderId = p.providerOrderId || ''
              const payId = p.providerPaymentId || ''

              const matchesSearch =
                patientName.toLowerCase().includes(query) ||
                docName.toLowerCase().includes(query) ||
                orderId.toLowerCase().includes(query) ||
                payId.toLowerCase().includes(query)

              return matchesStatus && matchesSearch
            })

            const totalVol = adminPayments
              .filter((p) => p.status === 'SUCCESS')
              .reduce((acc, p) => acc + (p.amount || 0), 0)

            return (
              <div className="admin-module-card">
                <div className="admin-module-header">
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                      Billing & Payments Management
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Real-time audit log of doctor consultation payments, gateway settlements & transactions
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="admin-search-wrap" style={{ minWidth: '240px' }}>
                      <SearchIcon size={16} />
                      <input
                        type="text"
                        placeholder="Search by order, patient, doctor..."
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        className="admin-search-input"
                      />
                    </div>

                    <select
                      className="admin-filter-select"
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="SUCCESS">Success</option>
                      <option value="PENDING">Pending</option>
                      <option value="FAILED">Failed</option>
                    </select>

                    <button
                      type="button"
                      className="admin-btn-secondary"
                      onClick={() => {
                        fetchAdminPayments(adminPaymentPage, paymentStatusFilter)
                      }}
                      disabled={adminPaymentLoading}
                    >
                      {adminPaymentLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {/* KPI Summary Bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    padding: '14px 18px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Total Volume Settled
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0d9488' }}>
                      ₹{totalVol.toLocaleString('en-IN')}
                    </h3>
                  </div>

                  <div style={{
                    padding: '14px 18px',
                    background: '#f0fdf4',
                    borderRadius: '12px',
                    border: '1px solid #bbf7d0',
                  }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                      Successful Transactions
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
                      {adminPayments.filter((p) => p.status === 'SUCCESS').length}
                    </h3>
                  </div>

                  <div style={{
                    padding: '14px 18px',
                    background: '#fff1f2',
                    borderRadius: '12px',
                    border: '1px solid #fecdd3',
                  }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' }}>
                      Failed Attempts
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#b91c1c' }}>
                      {adminPayments.filter((p) => p.status === 'FAILED').length}
                    </h3>
                  </div>
                </div>

                {/* Table */}
                {filteredPayments.length === 0 ? (
                  <div className="admin-empty-table">
                    <p style={{ margin: 0, color: '#64748b' }}>No payment records found matching your filters.</p>
                  </div>
                ) : (
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Patient</th>
                          <th>Doctor / Consultation</th>
                          <th>Amount</th>
                          <th>Provider</th>
                          <th>Status</th>
                          <th>Order & Payment ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((p) => {
                          const patientObj = typeof p.patientId === 'object' ? p.patientId : null
                          const apptObj = typeof p.bookingId === 'object' ? p.bookingId : null
                          const docObj = apptObj?.doctor as any

                          return (
                            <tr key={p._id}>
                              <td>
                                {p.createdAt
                                  ? new Date(p.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : 'N/A'}
                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8' }}>
                                  {p.createdAt
                                    ? new Date(p.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </span>
                              </td>
                              <td>
                                <strong>{patientObj?.name || 'Patient'}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                                  {patientObj?.email || ''}
                                </span>
                              </td>
                              <td>
                                <strong>{docObj?.user?.name || 'Doctor'}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                                  {docObj?.specialization || 'Specialist'}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>₹{p.amount}</strong>
                              </td>
                              <td>
                                <span className="admin-metric-tag blue">
                                  {p.provider === 'RAZORPAY' ? 'Razorpay' : 'Mock Gateway'}
                                </span>
                              </td>
                              <td>
                                <span className={`admin-status-pill ${p.status.toLowerCase()}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.74rem' }}>
                                  <code>{p.providerOrderId}</code>
                                  {p.providerPaymentId && <code>{p.providerPaymentId}</code>}
                                  {p.failureReason && (
                                    <span style={{ color: '#dc2626', fontSize: '0.7rem' }}>
                                      {p.failureReason}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {adminPaymentTotalPages > 1 && !adminPaymentLoading && (
                  <div style={{ marginTop: '20px' }}>
                    <Pagination
                      currentPage={adminPaymentPage}
                      totalPages={adminPaymentTotalPages}
                      totalItems={adminPaymentTotalItems}
                      itemsPerPage={10}
                      onPageChange={(p) => {
                        setAdminPaymentPage(p)
                        fetchAdminPayments(p, paymentStatusFilter)
                      }}
                      loading={adminPaymentLoading}
                    />
                  </div>
                )}
              </div>
            )
          })()}

          {/* ========================================================
              MODULE 7: COMPLAINTS & FEEDBACK MANAGEMENT
              ======================================================== */}
          {activeSection === 'complaints' && (() => {
            const filteredComplaints = complaintsList.filter((c) => {
              const matchesFilter =
                complaintFilter === 'all' ? true : c.status === complaintFilter
              const q = complaintSearch.toLowerCase().trim()
              if (!q) return matchesFilter
              return (
                matchesFilter &&
                (c.ticketId.toLowerCase().includes(q) ||
                  c.complainantName.toLowerCase().includes(q) ||
                  c.subject.toLowerCase().includes(q) ||
                  c.category.toLowerCase().includes(q))
              )
            })

            const totalCount = complaintsList.length
            const pendingCount = complaintsList.filter((c) => c.status === 'Pending Review').length
            const investigatingCount = complaintsList.filter((c) => c.status === 'Under Investigation').length
            const resolvedCount = complaintsList.filter((c) => c.status === 'Resolved').length

            return (
              <div className="admin-module-card">
                <div className="admin-module-header">
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageSquareIcon size={24} style={{ color: 'var(--admin-primary)' }} />
                      Patient & Provider Grievance Management
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Audit, triage, and resolve clinical, billing, and scheduling complaints
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="admin-search-wrap" style={{ minWidth: '220px' }}>
                      <SearchIcon size={16} />
                      <input
                        type="text"
                        placeholder="Search ticket, name, subject..."
                        value={complaintSearch}
                        onChange={(e) => setComplaintSearch(e.target.value)}
                        className="admin-search-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback Banner */}
                {complaintFeedback && (
                  <div
                    className="ppp-feedback-banner success"
                    style={{ marginBottom: '16px' }}
                    role="alert"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircleIcon size={18} />
                      <span>{complaintFeedback}</span>
                    </div>
                    <button
                      type="button"
                      className="ppp-feedback-close"
                      onClick={() => setComplaintFeedback(null)}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )}

                {/* KPI Metrics */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px',
                  marginBottom: '20px',
                }}>
                  <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Total Tickets
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                      {totalCount}
                    </h3>
                  </div>

                  <div style={{ padding: '14px 18px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>
                      Pending Review
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#b45309' }}>
                      {pendingCount}
                    </h3>
                  </div>

                  <div style={{ padding: '14px 18px', background: '#e0f2fe', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase' }}>
                      Under Investigation
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0284c7' }}>
                      {investigatingCount}
                    </h3>
                  </div>

                  <div style={{ padding: '14px 18px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' }}>
                      Resolved
                    </span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
                      {resolvedCount}
                    </h3>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {(['all', 'Pending Review', 'Under Investigation', 'Resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`admin-tf-tab ${complaintFilter === st ? 'active' : ''}`}
                      onClick={() => setComplaintFilter(st)}
                    >
                      {st === 'all' ? `All Tickets (${totalCount})` : st}
                    </button>
                  ))}
                </div>

                {/* Complaints Table */}
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Complainant</th>
                        <th>Category & Subject</th>
                        <th>Priority</th>
                        <th>Filed Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <MessageSquareIcon size={32} style={{ color: '#94a3b8' }} />
                              <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>No complaints found</strong>
                              <span style={{ fontSize: '0.84rem' }}>
                                {complaintSearch
                                  ? `No tickets matching "${complaintSearch}"`
                                  : 'No grievance records logged in this category.'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredComplaints.map((c) => {
                          const priorityColor =
                            c.priority === 'Urgent'
                              ? '#dc2626'
                              : c.priority === 'High'
                              ? '#ea580c'
                              : c.priority === 'Medium'
                              ? '#d97706'
                              : '#64748b'

                          const statusBg =
                            c.status === 'Resolved'
                              ? '#ecfdf5'
                              : c.status === 'Under Investigation'
                              ? '#e0f2fe'
                              : '#fef3c7'

                          const statusColor =
                            c.status === 'Resolved'
                              ? '#065f46'
                              : c.status === 'Under Investigation'
                              ? '#0369a1'
                              : '#92400e'

                          return (
                            <tr key={c.id}>
                              <td>
                                <code>{c.ticketId}</code>
                              </td>
                              <td>
                                <strong>{c.complainantName}</strong>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {c.role} • {c.complainantEmail}
                                </div>
                              </td>
                              <td style={{ maxWidth: '280px' }}>
                                <span className="admin-metric-tag blue" style={{ marginBottom: '4px' }}>
                                  {c.category}
                                </span>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' }}>
                                  {c.subject}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                  {c.description}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  color: priorityColor,
                                }}>
                                  ● {c.priority}
                                </span>
                              </td>
                              <td>{c.createdAt}</td>
                              <td>
                                <span
                                  className="admin-severity-pill"
                                  style={{ background: statusBg, color: statusColor }}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {c.status === 'Pending Review' && (
                                    <button
                                      type="button"
                                      className="admin-btn-approve"
                                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                      onClick={() => {
                                        setComplaintsList((prev) =>
                                          prev.map((item) =>
                                            item.id === c.id ? { ...item, status: 'Under Investigation' } : item
                                          )
                                        )
                                        setComplaintFeedback(`Ticket ${c.ticketId} escalated to Under Investigation.`)
                                      }}
                                    >
                                      Investigate
                                    </button>
                                  )}
                                  {c.status === 'Under Investigation' && (
                                    <button
                                      type="button"
                                      className="admin-btn-approve"
                                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                      onClick={() => {
                                        setComplaintsList((prev) =>
                                          prev.map((item) =>
                                            item.id === c.id ? { ...item, status: 'Resolved' } : item
                                          )
                                        )
                                        setComplaintFeedback(`Ticket ${c.ticketId} marked as Resolved.`)
                                      }}
                                    >
                                      Resolve
                                    </button>
                                  )}
                                  {c.status === 'Resolved' && (
                                    <button
                                      type="button"
                                      className="admin-tf-tab"
                                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                      onClick={() => {
                                        setComplaintsList((prev) =>
                                          prev.map((item) =>
                                            item.id === c.id ? { ...item, status: 'Under Investigation' } : item
                                          )
                                        )
                                        setComplaintFeedback(`Ticket ${c.ticketId} reopened for investigation.`)
                                      }}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* ========================================================
              MODULE 8: OPERATIONAL REPORTS & AUDIT ANALYTICS
              ======================================================== */}
          {activeSection === 'reports' && (() => {
            const handleExportReport = async () => {
              setExportingReport(true)
              setReportSuccessNotice(null)
              await new Promise((res) => setTimeout(res, 800))
              setExportingReport(false)
              setReportSuccessNotice(`Executive Analytics & Audit Report (${reportTimeframe}) exported successfully as PDF/CSV package.`)
            }

            const allDepts = Array.from(
              new Set([
                ...specializationsList,
                ...doctors.map((d) => d.specialization).filter(Boolean),
                ...hospitals.flatMap((h) => h.departments || []),
              ]),
            ).filter(Boolean) as string[]

            const departmentStats = allDepts.map((dept) => {
              const deptDocs = doctors.filter((d) => d.specialization?.toLowerCase() === dept.toLowerCase())
              const docIds = new Set(deptDocs.map((d) => String(d._id)))
              const deptAppts = allAppointments.filter((a) => {
                const docId = typeof a.doctor === 'object' ? String((a.doctor as any)?._id) : String(a.doctor)
                return docId && docIds.has(docId)
              })
              const deptRevenue = adminPayments
                .filter((p) => {
                  if (p.status !== 'SUCCESS') return false
                  const apptObj = typeof p.bookingId === 'object' ? (p.bookingId as any) : null
                  const docId = typeof apptObj?.doctor === 'object' ? String(apptObj.doctor?._id) : String(apptObj?.doctor)
                  return docId && docIds.has(docId)
                })
                .reduce((sum, p) => sum + (p.amount || 0), 0)

              return {
                name: dept,
                doctors: deptDocs.length,
                visits: deptAppts.length,
                revenue: deptRevenue,
                status: deptDocs.length > 0 ? 'Active' : 'Unstaffed',
              }
            })

            const totalRevenue = adminPayments
              .filter((p) => p.status === 'SUCCESS')
              .reduce((acc, p) => acc + (p.amount || 0), 0)
            const totalVisits = allAppointments.length
            const activeDoctorsCount = doctors.filter((d) => d.available).length
            const capacityRate = doctors.length > 0 ? Math.round((activeDoctorsCount / doctors.length) * 100) : 0
            const completedVisits = allAppointments.filter((a) => a.status === 'completed').length

            return (
              <div className="admin-module-card">
                <div className="admin-module-header">
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUpIcon size={24} style={{ color: 'var(--admin-primary)' }} />
                      Executive Performance & HealthGate Audit Reports
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Aggregated consultation volumes, physician utilization metrics, and financial summaries
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="admin-timeframe-tabs">
                      {(['7d', '30d', '90d', '1y'] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          className={`admin-tf-tab ${reportTimeframe === tf ? 'active' : ''}`}
                          onClick={() => setReportTimeframe(tf)}
                        >
                          {tf === '7d' ? 'Last 7 Days' : tf === '30d' ? 'Last 30 Days' : tf === '90d' ? 'Quarter' : 'Full Year'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={handleExportReport}
                      disabled={exportingReport}
                    >
                      {exportingReport ? (
                        <>
                          <span className="hg-spinner" />
                          Generating Export...
                        </>
                      ) : (
                        'Export Analytics Report'
                      )}
                    </button>
                  </div>
                </div>

                {/* Export Notice */}
                {reportSuccessNotice && (
                  <div
                    className="ppp-feedback-banner success"
                    style={{ marginBottom: '18px' }}
                    role="alert"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircleIcon size={18} />
                      <span>{reportSuccessNotice}</span>
                    </div>
                    <button
                      type="button"
                      className="ppp-feedback-close"
                      onClick={() => setReportSuccessNotice(null)}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )}

                {/* KPI Performance Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                  marginBottom: '24px',
                }}>
                  <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Total Consultations
                    </span>
                    <h3 style={{ margin: '6px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                      {totalVisits.toLocaleString('en-IN')}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{completedVisits} completed visits</span>
                  </div>

                  <div style={{ padding: '16px 20px', background: '#f0fdfa', borderRadius: '12px', border: '1px solid #ccfbf1' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0d9488', textTransform: 'uppercase' }}>
                      Consultation Revenue
                    </span>
                    <h3 style={{ margin: '6px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0f766e' }}>
                      ₹{totalRevenue.toLocaleString('en-IN')}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#0d9488', fontWeight: 600 }}>Settled consultation volume</span>
                  </div>

                  <div style={{ padding: '16px 20px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                      Doctor Availability / Capacity
                    </span>
                    <h3 style={{ margin: '6px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0369a1' }}>
                      {capacityRate}%
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>{activeDoctorsCount} of {doctors.length} verified practitioners active</span>
                  </div>

                  <div style={{ padding: '16px 20px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' }}>
                      Affiliated Network Centers
                    </span>
                    <h3 style={{ margin: '6px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
                      {hospitals.length}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 600 }}>{hospitals.filter((h) => h.isActive).length} active healthcare facilities</span>
                  </div>
                </div>

                {/* Department Utilization Table */}
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
                  Clinical Department Performance Breakdown
                </h3>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Department / Specialty</th>
                        <th>Onboarded Doctors</th>
                        <th>Visits Completed</th>
                        <th>Net Revenue</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                            No departments or specialties registered yet.
                          </td>
                        </tr>
                      ) : (
                        departmentStats.map((dep) => (
                          <tr key={dep.name}>
                            <td>
                              <strong>{dep.name}</strong>
                            </td>
                            <td>{dep.doctors} Specialist{dep.doctors !== 1 ? 's' : ''}</td>
                            <td>
                              <strong>{dep.visits}</strong>
                            </td>
                            <td>
                              <strong style={{ color: '#0d9488' }}>₹{dep.revenue.toLocaleString('en-IN')}</strong>
                            </td>
                            <td>
                              <span className="admin-severity-pill" style={{
                                background: dep.status === 'Active' ? '#ecfdf5' : '#f8fafc',
                                color: dep.status === 'Active' ? '#065f46' : '#64748b'
                              }}>
                                {dep.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboardPage
