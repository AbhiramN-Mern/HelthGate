import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './App.css'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import HomePage from './pages/HomePage'
import PatientHomePage from './pages/pationt/PatientHomePage'
import ErrorPage from './pages/error page/ErrorPage'
import ErrorBoundary from './components/ErrorBoundary'

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
    const nextRoute = userData.role === 'admin' ? '/admin' : '/patient/home'
    navigate(nextRoute)
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

  const isLoggedIn = !!localStorage.getItem('helthgate_token')

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                localStorage.getItem('helthgate_token') && JSON.parse(localStorage.getItem('helthgate_user') || '{}')?.role === 'admin'
                  ? '/admin'
                  : localStorage.getItem('helthgate_token')
                    ? '/patient/home'
                    : '/home'
              }
              replace
            />
          }
        />
        <Route
          path="/home"
          element={<HomePage isLoggedIn={isLoggedIn} />}
        />
        <Route
          path="/patient/home"
          element={
            localStorage.getItem('helthgate_token') ? (
              <PatientHomePage user={user} onLogout={handleLogout} onRequireAuth={requireAuth} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/patient"
          element={<Navigate to="/patient/home" replace />}
        />
        <Route
          path="/login"
          element={
            localStorage.getItem('helthgate_token') ? (
              <Navigate to={JSON.parse(localStorage.getItem('helthgate_user') || '{}')?.role === 'admin' ? '/admin' : '/patient/home'} replace />
            ) : (
              <LoginPage onSuccess={handleAuthSuccess} onSwitchToRegister={() => navigate('/register')} />
            )
          }
        />
        <Route
          path="/register"
          element={
            localStorage.getItem('helthgate_token') ? (
              <Navigate to={JSON.parse(localStorage.getItem('helthgate_user') || '{}')?.role === 'admin' ? '/admin' : '/patient/home'} replace />
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
        <Route
          path="/admin"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="patients" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/patients"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="patients" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/patients/:id"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="patients" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/doctors"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="doctors" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/doctors/:id"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="doctors" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/hospitals"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="hospitals" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/hospitals/:id"
          element={
            localStorage.getItem('helthgate_token') && user?.role === 'admin' ? (
              <AdminDashboardPage user={user} onLogout={handleLogout} initialSection="hospitals" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/error" element={<ErrorPage />} />
        <Route
          path="*"
          element={<ErrorPage code={404} title="Page Not Found" message="The page or path you requested could not be found." />}
        />
      </Routes>
    </ErrorBoundary>
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
