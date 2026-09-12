const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export type AuthUser = {
  id?: string
  name?: string
  email?: string
  role?: string
}

export type AuthResponse = {
  success: boolean
  message: string
  token?: string
  user?: AuthUser
}

export type PatientProfile = {
  _id?: string
  user?: { name?: string; email?: string; role?: string }
  dateOfBirth?: string
  gender?: string
  phone?: string
  address?: string
  profileImage?: string
  bloodGroup?: string
  allergies?: string[]
  medicalHistory?: string[]
}

export type DoctorAvailability = {
  workingDays?: string[]
  workingHours?: { start?: string; end?: string }
  availableSlots?: string[]
  blockedDates?: string[]
}

export type DoctorProfile = {
  _id?: string
  user?: { name?: string; email?: string; role?: string }
  specialization?: string
  qualification?: string
  hospital?: { _id?: string; name?: string; isActive?: boolean }
  affiliatedHospitals?: {
    _id?: string
    name?: string
    department?: string
    relationshipId?: string
    joinedAt?: string
  }[]
  isFreelance?: boolean
  profileImage?: string
  experienceYears?: number
  experience?: number | string
  licenseNumber?: string
  consultationFee?: number
  available?: boolean
  availability?: DoctorAvailability
  verificationStatus?: 'pending' | 'verified' | 'rejected'
}

export const getFriendlyErrorMessage = (error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string => {
  if (!error) return fallbackMessage

  const message = typeof error === 'string'
    ? error
    : error instanceof Error
    ? error.message
    : (error as any)?.message || fallbackMessage

  const lower = message.toLowerCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('connection refused') ||
    lower.includes('err_connection_refused')
  ) {
    return 'Unable to connect to the HealthGate server. Please check your internet connection or verify the server is running.'
  }

  if (
    lower.includes('jwt expired') ||
    lower.includes('token expired') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid token')
  ) {
    return 'Your session has expired. Please sign in again to continue.'
  }

  if (
    lower.includes('unexpected token') ||
    lower.includes('syntaxerror') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout') ||
    lower.includes('service unavailable')
  ) {
    return 'The server encountered an unexpected error or is temporarily unavailable. Please try again shortly.'
  }

  return message
}

const request = async <T>(endpoint: string, options: RequestInit, token?: string): Promise<T> => {
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })
  } catch (err: unknown) {
    throw new Error(getFriendlyErrorMessage(err))
  }

  let data: any
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    try {
      const text = await response.text()
      data = { message: text }
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      const msg = data?.message || 'Your session has expired. Please sign in again.'
      throw new Error(msg)
    }

    const serverMsg = data?.message || data?.error || `Request failed with status ${response.status}`
    throw new Error(getFriendlyErrorMessage(serverMsg))
  }

  return (data || {}) as T
}

export const registerUser = async (payload: {
  name: string
  email: string
  password: string
  role?: string
  profile?: Record<string, unknown>
}): Promise<AuthResponse> => {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const loginUser = async (payload: {
  email: string
  password: string
}): Promise<AuthResponse> => {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getMyPatientProfile = async (token: string): Promise<{ success: boolean; patient?: PatientProfile }> => {
  return request<{ success: boolean; patient?: PatientProfile }>('/api/patients/me', { method: 'GET' }, token)
}

export const updatePatientProfile = async (
  payload: Record<string, unknown>,
  token: string,
): Promise<{ success: boolean; patient?: PatientProfile; message?: string }> => {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }

    if (value instanceof File) {
      formData.append(key, value)
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, String(item)))
      return
    }

    formData.append(key, String(value))
  })

  return request<{ success: boolean; patient?: PatientProfile; message?: string }>('/api/patients/me', {
    method: 'PUT',
    body: formData,
  }, token)
}

export const getMyDoctorProfile = async (token: string): Promise<{ success: boolean; doctor?: DoctorProfile }> => {
  return request<{ success: boolean; doctor?: DoctorProfile }>('/api/doctors/me', { method: 'GET' }, token)
}

export const updateDoctorProfile = async (
  payload: Record<string, unknown>,
  token: string,
): Promise<{ success: boolean; doctor?: DoctorProfile; message?: string }> => {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }

    if (value instanceof File) {
      formData.append(key, value)
      return
    }

    formData.append(key, String(value))
  })

  return request<{ success: boolean; doctor?: DoctorProfile; message?: string }>('/api/doctors/me', {
    method: 'PUT',
    body: formData,
  }, token)
}

export type AdminPatient = {
  _id?: string
  active?: boolean
  profileImage?: string
  phone?: string
  address?: string
  gender?: string
  bloodGroup?: string
  allergies?: string[]
  medicalHistory?: string[]
  dateOfBirth?: string
  createdAt?: string
  updatedAt?: string
  user?: {
    _id?: string
    name?: string
    email?: string
    role?: string
  }
}

export type AdminDoctor = {
  _id?: string
  active?: boolean
  profileImage?: string
  specialization?: string
  qualification?: string
  licenseNumber?: string
  consultationFee?: number
  experienceYears?: number
  available?: boolean
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  hospital?: {
    _id?: string
    name?: string
    isActive?: boolean
  } | null
  createdAt?: string
  updatedAt?: string
  user?: {
    _id?: string
    name?: string
    email?: string
    role?: string
  }
}

export const getAllPatientsForAdmin = async (token: string): Promise<{ success: boolean; patients?: AdminPatient[] }> => {
  return request<{ success: boolean; patients?: AdminPatient[] }>('/api/admin/patients', { method: 'GET' }, token)
}

export const getPatientByIdForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; patient?: AdminPatient }> => {
  return request<{ success: boolean; patient?: AdminPatient }>(`/api/admin/patients/${id}`, { method: 'GET' }, token)
}

export const updatePatientByIdForAdmin = async (
  id: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ success: boolean; patient?: AdminPatient; message?: string }> => {
  return request<{ success: boolean; patient?: AdminPatient; message?: string }>(`/api/admin/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export const togglePatientStatusForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; patient?: AdminPatient }> => {
  return request<{ success: boolean; message?: string; patient?: AdminPatient }>(`/api/admin/patients/${id}/status`, {
    method: 'PATCH',
  }, token)
}

export const createDoctorForAdmin = async (
  payload: {
    name: string
    email: string
    password: string
    specialization: string
    qualification: string
    licenseNumber: string
    consultationFee?: number
    experienceYears?: number
    available?: boolean
    profileImage?: string
  },
  token: string,
): Promise<{ success: boolean; message?: string; doctor?: AdminDoctor; user?: AuthUser }> => {
  return request<{ success: boolean; message?: string; doctor?: AdminDoctor; user?: AuthUser }>('/api/admin/doctors', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export const getAllDoctorsForAdmin = async (token: string): Promise<{ success: boolean; doctors?: AdminDoctor[] }> => {
  return request<{ success: boolean; doctors?: AdminDoctor[] }>('/api/admin/doctors', { method: 'GET' }, token)
}

export const getDoctorByIdForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; doctor?: AdminDoctor }> => {
  return request<{ success: boolean; doctor?: AdminDoctor }>(`/api/admin/doctors/${id}`, { method: 'GET' }, token)
}

export const updateDoctorByIdForAdmin = async (
  id: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ success: boolean; doctor?: AdminDoctor; message?: string }> => {
  return request<{ success: boolean; doctor?: AdminDoctor; message?: string }>(`/api/admin/doctors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export const toggleDoctorStatusForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; doctor?: AdminDoctor }> => {
  return request<{ success: boolean; message?: string; doctor?: AdminDoctor }>(`/api/admin/doctors/${id}/status`, {
    method: 'PATCH',
  }, token)
}

export const verifyDoctorForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; doctor?: AdminDoctor }> => {
  return request<{ success: boolean; message?: string; doctor?: AdminDoctor }>(`/api/admin/doctors/${id}/verify`, {
    method: 'PATCH',
  }, token)
}

export const rejectDoctorForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; doctor?: AdminDoctor }> => {
  return request<{ success: boolean; message?: string; doctor?: AdminDoctor }>(`/api/admin/doctors/${id}/reject`, {
    method: 'PATCH',
  }, token)
}

export const deleteDoctorForAdmin = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string }> => {
  return request<{ success: boolean; message?: string }>(`/api/admin/doctors/${id}`, {
    method: 'DELETE',
  }, token)
}

export type HospitalAddress = {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export type HospitalContact = {
  phone?: string
  email?: string
  website?: string
}

export type Hospital = {
  _id?: string
  name: string
  licenseNumber?: string
  address?: HospitalAddress
  contactInfo?: HospitalContact
  departments?: string[]
  isActive?: boolean
  verificationStatus?: 'verified' | 'pending' | 'unverified'
  activeDoctorsCount?: number
  doctors?: any[]
  myRelationship?: HospitalDoctorItem | null
  createdAt?: string
  updatedAt?: string
}

export type HospitalDoctorStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED'
export type RequestedBy = 'DOCTOR' | 'ADMIN'

export type HospitalDoctorItem = {
  _id: string
  hospital: Hospital
  doctor: DoctorProfile | AdminDoctor | any
  department?: string
  status: HospitalDoctorStatus
  requestedBy: RequestedBy
  approvedBy?: { _id?: string; name?: string; email?: string } | null
  rejectionReason?: string
  joinedAt?: string
  createdAt?: string
  updatedAt?: string
}

export const getActiveHospitals = async (): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  return request<{ success: boolean; hospitals?: Hospital[] }>('/api/hospitals/active', { method: 'GET' })
}

export const getAllHospitalsForAdmin = async (token: string): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  return request<{ success: boolean; hospitals?: Hospital[] }>('/api/hospitals', { method: 'GET' }, token)
}

export const createHospitalForAdmin = async (
  payload: {
    name: string
    licenseNumber?: string
    address?: HospitalAddress
    contactInfo?: HospitalContact
    departments?: string[]
    isActive?: boolean
    verificationStatus?: string
  },
  token: string,
): Promise<{ success: boolean; hospital?: Hospital }> => {
  return request<{ success: boolean; hospital?: Hospital }>('/api/hospitals', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export const updateHospitalByIdForAdmin = async (
  id: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ success: boolean; hospital?: Hospital }> => {
  return request<{ success: boolean; hospital?: Hospital }>(`/api/hospitals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export const toggleHospitalStatusApi = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; hospital?: Hospital }> => {
  return request<{ success: boolean; message?: string; hospital?: Hospital }>(`/api/hospitals/${id}/status`, {
    method: 'PATCH',
  }, token)
}

export const verifyHospitalApi = async (
  id: string,
  status: string,
  token: string,
): Promise<{ success: boolean; message?: string; hospital?: Hospital }> => {
  return request<{ success: boolean; message?: string; hospital?: Hospital }>(`/api/hospitals/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

// Doctor-Hospital Affiliation APIs (Doctor Dashboard)
export const getMyDoctorHospitalsApi = async (
  token: string,
): Promise<{
  success: boolean
  all?: HospitalDoctorItem[]
  pending?: HospitalDoctorItem[]
  active?: HospitalDoctorItem[]
  rejected?: HospitalDoctorItem[]
  removed?: HospitalDoctorItem[]
  history?: HospitalDoctorItem[]
}> => {
  return request<{
    success: boolean
    all?: HospitalDoctorItem[]
    pending?: HospitalDoctorItem[]
    active?: HospitalDoctorItem[]
    rejected?: HospitalDoctorItem[]
    removed?: HospitalDoctorItem[]
    history?: HospitalDoctorItem[]
  }>('/api/doctors/me/hospitals', { method: 'GET' }, token)
}

export const searchHospitalsForDoctorApi = async (
  token: string,
  query?: string,
): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  const qs = query ? `?query=${encodeURIComponent(query)}` : ''
  return request<{ success: boolean; hospitals?: Hospital[] }>(`/api/doctors/hospitals/search${qs}`, { method: 'GET' }, token)
}

export const requestJoinHospitalApi = async (
  payload: { hospitalId: string; department?: string },
  token: string,
): Promise<{ success: boolean; message?: string; request?: HospitalDoctorItem }> => {
  return request<{ success: boolean; message?: string; request?: HospitalDoctorItem }>('/api/doctors/hospitals/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

// Doctor-Hospital Governance APIs (Main Admin)
export const getAllHospitalDoctorsForAdminApi = async (
  token: string,
  params?: { status?: string; hospitalId?: string; doctorId?: string },
): Promise<{ success: boolean; relationships?: HospitalDoctorItem[] }> => {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.hospitalId) query.set('hospitalId', params.hospitalId)
  if (params?.doctorId) query.set('doctorId', params.doctorId)
  const qs = query.toString() ? `?${query.toString()}` : ''
  return request<{ success: boolean; relationships?: HospitalDoctorItem[] }>(`/api/admin/hospital-doctors${qs}`, { method: 'GET' }, token)
}

export const approveDoctorHospitalRequestApi = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }> => {
  return request<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }>(`/api/admin/hospital-doctors/${id}/approve`, {
    method: 'PATCH',
  }, token)
}

export const rejectDoctorHospitalRequestApi = async (
  id: string,
  reason: string,
  token: string,
): Promise<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }> => {
  return request<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }>(`/api/admin/hospital-doctors/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  }, token)
}

export const associateDoctorWithHospitalApi = async (
  payload: { doctorId: string; hospitalId: string; department?: string },
  token: string,
): Promise<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }> => {
  return request<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }>('/api/admin/hospital-doctors/associate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export const removeDoctorFromHospitalApi = async (
  id: string,
  token: string,
): Promise<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }> => {
  return request<{ success: boolean; message?: string; relationship?: HospitalDoctorItem }>(`/api/admin/hospital-doctors/${id}/remove`, {
    method: 'PATCH',
  }, token)
}

export const getHospitalDoctorHistoryApi = async (
  token: string,
): Promise<{ success: boolean; history?: HospitalDoctorItem[] }> => {
  return request<{ success: boolean; history?: HospitalDoctorItem[] }>('/api/admin/hospital-doctors/history', { method: 'GET' }, token)
}

export type RescheduleRequest = {
  status: 'pending' | 'accepted' | 'declined' | 'none'
  proposedDate?: string
  proposedTimeSlot?: string
  reason?: string
  requestedBy?: 'doctor' | 'patient'
  requestedAt?: string
  respondedAt?: string
}

export type AppointmentItem = {
  _id?: string
  patient?: { _id?: string; name?: string; email?: string }
  doctor?: DoctorProfile
  hospital?: Hospital
  hospitalDoctor?: HospitalDoctorItem
  department?: string
  isHospitalAppointment?: boolean
  appointmentDate?: string
  timeSlot?: string
  status?: string
  reason?: string
  type?: string
  createdAt?: string
  rescheduleRequest?: RescheduleRequest
}

export const getSpecializations = async (): Promise<{ success: boolean; specializations?: string[] }> => {
  return request<{ success: boolean; specializations?: string[] }>('/api/specializations', { method: 'GET' })
}

export const getAvailableDoctors = async (
  params?: { search?: string; specialization?: string; hospital?: string },
  token?: string,
): Promise<{ success: boolean; doctors?: DoctorProfile[] }> => {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.specialization) query.set('specialization', params.specialization)
  if (params?.hospital) query.set('hospital', params.hospital)
  const qs = query.toString() ? `?${query.toString()}` : ''
  return request<{ success: boolean; doctors?: DoctorProfile[] }>(`/api/doctors${qs}`, { method: 'GET' }, token)
}

export const getHospitals = async (token?: string): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  return request<{ success: boolean; hospitals?: Hospital[] }>('/api/hospitals', { method: 'GET' }, token)
}

export const getMyAppointments = async (token: string): Promise<{ success: boolean; appointments?: AppointmentItem[] }> => {
  return request<{ success: boolean; appointments?: AppointmentItem[] }>('/api/appointments/my', { method: 'GET' }, token)
}

export type NotificationItem = {
  _id: string
  type:
    | 'new_appointment'
    | 'cancellation'
    | 'rescheduled'
    | 'reschedule_request'
    | 'reschedule_response'
    | 'system'
    | 'general'
  title: string
  message: string
  isRead?: boolean
  appointment?: string
  createdAt?: string
}

export type DoctorDashboardData = {
  success: boolean
  message?: string
  doctor?: DoctorProfile
  stats?: {
    todayAppointments: number
    upcomingAppointments: number
    completedAppointments: number
    totalPatients: number
  }
  todayAppointments?: AppointmentItem[]
  upcomingAppointments?: AppointmentItem[]
  recentPatients?: {
    patientId: string
    name: string
    email: string
    lastAppointmentDate: string
    lastAppointmentStatus: string
    appointmentType: string
    totalVisits: number
  }[]
  notifications?: NotificationItem[]
  availability?: DoctorAvailability
}

export const getDoctorDashboard = async (token: string): Promise<DoctorDashboardData> => {
  return request<DoctorDashboardData>('/api/doctors/dashboard', { method: 'GET' }, token)
}

export const updateDoctorAvailabilityApi = async (
  payload: {
    workingDays?: string[]
    workingHours?: { start?: string; end?: string }
    availableSlots?: string[]
    blockedDates?: string[]
    available?: boolean
  },
  token: string,
): Promise<{ success: boolean; availability?: DoctorAvailability; available?: boolean; message?: string }> => {
  return request<{ success: boolean; availability?: DoctorAvailability; available?: boolean; message?: string }>('/api/doctors/availability', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export const updateAppointmentStatusApi = async (
  appointmentId: string,
  status: string,
  token: string,
): Promise<{ success: boolean; appointment?: AppointmentItem; message?: string }> => {
  return request<{ success: boolean; appointment?: AppointmentItem; message?: string }>(`/api/doctors/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

export const getDoctorPatientDetailsApi = async (
  patientId: string,
  token: string,
): Promise<{
  success: boolean
  patient?: {
    id: string
    name: string
    email: string
    gender?: string
    phone?: string
    bloodGroup?: string
    dateOfBirth?: string
    address?: string
  }
  appointments?: AppointmentItem[]
}> => {
  return request<{
    success: boolean
    patient?: {
      id: string
      name: string
      email: string
      gender?: string
      phone?: string
      bloodGroup?: string
      dateOfBirth?: string
      address?: string
    }
    appointments?: AppointmentItem[]
  }>(`/api/doctors/patients/${patientId}`, { method: 'GET' }, token)
}

export const markNotificationReadApi = async (notificationId: string, token: string): Promise<{ success: boolean }> => {
  return request<{ success: boolean }>(`/api/doctors/notifications/${notificationId}/read`, { method: 'PATCH' }, token)
}

export const getDoctorBookedSlotsApi = async (
  doctorId: string,
  params?: { date?: string; month?: string },
  token?: string | null,
): Promise<{
  success: boolean
  doctor?: string
  date?: string
  month?: string
  bookedSlots?: string[]
  bookedSlotsByDate?: Record<string, string[]>
}> => {
  const query = new URLSearchParams({ doctor: doctorId })
  if (params?.date) query.set('date', params.date)
  if (params?.month) query.set('month', params.month)

  return request<{
    success: boolean
    doctor?: string
    date?: string
    month?: string
    bookedSlots?: string[]
    bookedSlotsByDate?: Record<string, string[]>
  }>(`/api/appointments/booked-slots?${query.toString()}`, { method: 'GET' }, token || undefined)
}

export const requestAppointmentRescheduleApi = async (
  appointmentId: string,
  payload: { newDate: string; newTimeSlot: string; reason?: string },
  token: string,
): Promise<{ success: boolean; message?: string; appointment?: AppointmentItem }> => {
  return request<{ success: boolean; message?: string; appointment?: AppointmentItem }>(
    `/api/appointments/${appointmentId}/reschedule`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export const respondAppointmentRescheduleApi = async (
  appointmentId: string,
  action: 'accept' | 'decline',
  token: string,
): Promise<{ success: boolean; message?: string; appointment?: AppointmentItem }> => {
  return request<{ success: boolean; message?: string; appointment?: AppointmentItem }>(
    `/api/appointments/${appointmentId}/reschedule/respond`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    },
    token,
  )
}

export const getPatientNotificationsApi = async (
  token: string,
): Promise<{ success: boolean; notifications?: NotificationItem[] }> => {
  return request<{ success: boolean; notifications?: NotificationItem[] }>(
    '/api/patients/notifications',
    { method: 'GET' },
    token,
  )
}

export const markPatientNotificationReadApi = async (
  notificationId: string,
  token: string,
): Promise<{ success: boolean; message?: string }> => {
  return request<{ success: boolean; message?: string }>(
    `/api/patients/notifications/${notificationId}/read`,
    { method: 'PATCH' },
    token,
  )
}

export type AdminDashboardStats = {
  totalPatients: number
  totalDoctors: number
  totalHospitals: number
  totalAppointments: number
  pendingDoctorApprovals: number
  pendingDoctorJoinRequests?: number
  todayAppointments: number
}

export type AdminDashboardData = {
  success: boolean
  message?: string
  stats?: AdminDashboardStats
  appointmentsOverview?: {
    daily: { label: string; date: string; count: number }[]
    weekly: { label: string; count: number }[]
    monthly: { label: string; count: number }[]
  }
  userGrowth?: {
    month: string
    patients: number
    doctors: number
  }[]
  recentAppointments?: AppointmentItem[]
  pendingDoctors?: AdminDoctor[]
}

export const getAdminDashboardApi = async (token: string): Promise<AdminDashboardData> => {
  return request<AdminDashboardData>('/api/admin/dashboard', { method: 'GET' }, token)
}

export const getAllAppointmentsForAdminApi = async (token: string): Promise<{ success: boolean; appointments?: AppointmentItem[] }> => {
  return request<{ success: boolean; appointments?: AppointmentItem[] }>('/api/admin/appointments', { method: 'GET' }, token)
}

// ==========================================
// PAYMENT MODULE TYPES & API CALLS
// ==========================================

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
export type PaymentProvider = 'MOCK' | 'RAZORPAY'

export type PaymentRecord = {
  _id: string
  bookingId: string | {
    _id: string
    appointmentDate?: string
    timeSlot?: string
    doctor?: {
      _id?: string
      user?: { name?: string; email?: string }
      specialization?: string
      consultationFee?: number
    }
    hospital?: { name?: string }
    status?: string
    reason?: string
    type?: string
  }
  patientId: string | {
    _id: string
    name?: string
    email?: string
  }
  amount: number
  currency: string
  status: PaymentStatus
  provider: PaymentProvider
  providerOrderId: string
  providerPaymentId?: string | null
  failureReason?: string | null
  createdAt: string
  updatedAt: string
}

export type PaymentOrderResult = {
  providerOrderId: string
  amount: number
  currency: string
  provider: PaymentProvider
  keyId?: string
  mockCheckoutToken?: string
  notes?: Record<string, any>
}

export type CreatePaymentOrderResponse = {
  success: boolean
  message?: string
  payment: PaymentRecord
  order: PaymentOrderResult
  appointment?: any
}

export type VerifyPaymentRequest = {
  paymentId?: string
  providerOrderId?: string
  providerPaymentId?: string
  razorpaySignature?: string
  simulateStatus?: 'SUCCESS' | 'FAILED'
  failureReason?: string
  mockToken?: string
}

export type VerifyPaymentResponse = {
  success: boolean
  message: string
  payment?: PaymentRecord
  appointment?: any
  canRetry?: boolean
}

export type PaymentHistoryResponse = {
  success: boolean
  payments: PaymentRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const createPaymentOrderApi = async (
  bookingId: string,
  token: string,
): Promise<CreatePaymentOrderResponse> => {
  return request<CreatePaymentOrderResponse>(
    '/api/payments/orders',
    {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    },
    token,
  )
}

export const verifyPaymentApi = async (
  payload: VerifyPaymentRequest,
  token: string,
): Promise<VerifyPaymentResponse> => {
  return request<VerifyPaymentResponse>(
    '/api/payments/verify',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export const retryPaymentApi = async (
  paymentId: string,
  token: string,
): Promise<CreatePaymentOrderResponse> => {
  return request<CreatePaymentOrderResponse>(
    `/api/payments/${paymentId}/retry`,
    {
      method: 'POST',
    },
    token,
  )
}

export const getPaymentsApi = async (
  params?: { status?: string; page?: number; limit?: number },
  token?: string,
): Promise<PaymentHistoryResponse> => {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.page) query.append('page', String(params.page))
  if (params?.limit) query.append('limit', String(params.limit))
  const qs = query.toString() ? `?${query.toString()}` : ''

  return request<PaymentHistoryResponse>(`/api/payments${qs}`, { method: 'GET' }, token)
}

export const getPaymentByIdApi = async (
  paymentId: string,
  token: string,
): Promise<{ success: boolean; payment: PaymentRecord }> => {
  return request<{ success: boolean; payment: PaymentRecord }>(
    `/api/payments/${paymentId}`,
    { method: 'GET' },
    token,
  )
}




