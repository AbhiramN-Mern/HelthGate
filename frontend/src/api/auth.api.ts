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

export type DoctorProfile = {
  _id?: string
  user?: { name?: string; email?: string; role?: string }
  specialization?: string
  qualification?: string
  profileImage?: string
  experienceYears?: number
  licenseNumber?: string
  consultationFee?: number
  available?: boolean
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
