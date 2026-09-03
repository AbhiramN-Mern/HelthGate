import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './App.css'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'

type AuthUser = {
  name?: string
  email?: string
  role?: string
}

function AppShell() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('helthgate_token')
    const userData = localStorage.getItem('helthgate_user')

    if (token && userData) {
      setUser(JSON.parse(userData) as AuthUser)
    }
  }, [])

  const handleAuthSuccess = (userData: AuthUser, token?: string) => {
    const activeToken = token || localStorage.getItem('helthgate_token') || 'demo-token'
    localStorage.setItem('helthgate_token', activeToken)
    localStorage.setItem('helthgate_user', JSON.stringify(userData))
    setUser(userData)
    navigate('/profile')
  }

  const handleLogout = () => {
    localStorage.removeItem('helthgate_token')
    localStorage.removeItem('helthgate_user')
    setUser(null)
    navigate('/login')
  }

  const requireAuth = () => {
    if (!localStorage.getItem('helthgate_token')) {
      setUser(null)
      navigate('/login')
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={localStorage.getItem('helthgate_token') ? '/profile' : '/login'} replace />} />
      <Route
        path="/login"
        element={
          localStorage.getItem('helthgate_token') ? (
            <Navigate to="/profile" replace />
          ) : (
            <LoginPage onSuccess={handleAuthSuccess} onSwitchToRegister={() => navigate('/register')} />
          )
        }
      />
      <Route
        path="/register"
        element={
          localStorage.getItem('helthgate_token') ? (
            <Navigate to="/profile" replace />
          ) : (
            <RegisterPage onSuccess={handleAuthSuccess} onSwitchToLogin={() => navigate('/login')} />
          )
        }
      />
      <Route
        path="/profile"
        element={
          localStorage.getItem('helthgate_token') ? (
            <ProfilePage user={user} onLogout={handleLogout} onRequireAuth={requireAuth} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
