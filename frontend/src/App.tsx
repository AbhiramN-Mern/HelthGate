import { useEffect, useState } from 'react'
import './App.css'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'

type AuthUser = {
  name?: string
  email?: string
  role?: string
}

function App() {
  const [screen, setScreen] = useState<'login' | 'register' | 'home'>('login')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('helthgate_token')
    const userData = localStorage.getItem('helthgate_user')

    if (token && userData) {
      setUser(JSON.parse(userData))
      setScreen('home')
    }
  }, [])

  const handleAuthSuccess = (userData: AuthUser) => {
    localStorage.setItem('helthgate_token', 'demo-token')
    localStorage.setItem('helthgate_user', JSON.stringify(userData))
    setUser(userData)
    setScreen('home')
  }

  const handleLogout = () => {
    localStorage.removeItem('helthgate_token')
    localStorage.removeItem('helthgate_user')
    setUser(null)
    setScreen('login')
  }

  const requireAuth = () => {
    if (!localStorage.getItem('helthgate_token')) {
      setUser(null)
      setScreen('login')
    }
  }

  if (screen === 'home') {
    return <HomePage user={user} onLogout={handleLogout} onRequireAuth={requireAuth} />
  }

  if (screen === 'register') {
    return <RegisterPage onSuccess={handleAuthSuccess} onSwitchToLogin={() => setScreen('login')} />
  }

  return <LoginPage onSuccess={handleAuthSuccess} onSwitchToRegister={() => setScreen('register')} />
}

export default App
