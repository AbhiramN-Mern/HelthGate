const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export type AuthResponse = {
  success: boolean
  message: string
  token?: string
  user?: {
    id?: string
    name?: string
    email?: string
    role?: string
  }
}

const request = async <T>(endpoint: string, options: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
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
