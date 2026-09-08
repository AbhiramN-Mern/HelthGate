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
  profileImage?: string
  experienceYears?: number
  licenseNumber?: string
  consultationFee?: number
  available?: boolean
  availability?: DoctorAvailability
  verificationStatus?: 'pending' | 'verified' | 'rejected'
}

const request = async <T>(endpoint: string, options: RequestInit, token?: string): Promise<T> => {
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const data = (await response.json()) as T & { message?: string }

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed')
  }

  return data
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

export type Hospital = {
  _id?: string
  name?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export const getActiveHospitals = async (): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  return request<{ success: boolean; hospitals?: Hospital[] }>('/api/hospitals/active', { method: 'GET' })
}

export const getAllHospitalsForAdmin = async (token: string): Promise<{ success: boolean; hospitals?: Hospital[] }> => {
  return request<{ success: boolean; hospitals?: Hospital[] }>('/api/hospitals', { method: 'GET' }, token)
}

export const createHospitalForAdmin = async (payload: { name: string; isActive?: boolean }, token: string): Promise<{ success: boolean; hospital?: Hospital }> => {
  return request<{ success: boolean; hospital?: Hospital }>('/api/hospitals', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export const updateHospitalByIdForAdmin = async (id: string, payload: Record<string, unknown>, token: string): Promise<{ success: boolean; hospital?: Hospital }> => {
  return request<{ success: boolean; hospital?: Hospital }>(`/api/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
}

export type AppointmentItem = {
  _id?: string
  patient?: { _id?: string; name?: string; email?: string }
  doctor?: DoctorProfile
  hospital?: Hospital
  appointmentDate?: string
  timeSlot?: string
  status?: string
  reason?: string
  type?: string
  createdAt?: string
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
  type: 'new_appointment' | 'cancellation' | 'rescheduled' | 'system' | 'general'
  title: string
  message: string
  isRead?: boolean
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



