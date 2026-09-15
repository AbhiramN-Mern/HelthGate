import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDoctorDashboard,
  markNotificationReadApi,
  getFriendlyErrorMessage,
  type AuthUser,
  type DoctorProfile,
  type NotificationItem,
} from '../../api/auth.api'
import './DoctorPages.css'
import {
  BellIcon,
  UsersIcon,
  CalendarIcon,
  RefreshIcon,
  AlertCircleIcon,
  SettingsIcon,
  CheckCircleIcon,
} from '../../components/common/Icons'
import { Pagination } from '../../components/common/Pagination'

type DoctorNotificationsPageProps = {
  user?: AuthUser | null
  onLogout: () => void
  onRequireAuth: () => void
}

function DoctorNotificationsPage({ user, onLogout, onRequireAuth }: DoctorNotificationsPageProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('helthgate_token') || ''

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [patientCount, setPatientCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  // Filter tab: all, unread, appointment, reschedule, cancellation, system
  const [filterType, setFilterType] = useState<string>('all')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDoctorDashboard(token)
      if (data.doctor) setDoctor(data.doctor)
      if (data.notifications) setNotifications(data.notifications)
      if (data.recentPatients) setPatientCount(data.recentPatients.length)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to load notifications'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      onRequireAuth()
      return
    }
    fetchData()
  }, [token])

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationReadApi(id, token)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      )
    } catch (err) {
      console.warn('Failed to mark notification as read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead)
    if (unread.length === 0) return

    setMarkingAll(true)
    try {
      await Promise.all(unread.map((n) => markNotificationReadApi(n._id, token).catch(() => null)))
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (err) {
      console.warn('Failed marking all as read:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  // Filter notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'all') return true
    if (filterType === 'unread') return !n.isRead
    if (filterType === 'appointment') return !n.type || n.type === 'new_appointment' || n.type === 'appointment' || n.type === 'appointment_confirmed'
    if (filterType === 'rescheduled') return n.type === 'rescheduled' || n.type === 'reschedule_request' || n.type === 'reschedule_response'
    if (filterType === 'cancellation') return n.type === 'cancellation'
    if (filterType === 'system') return n.type === 'system'
    return true
  })

  // Pagination for Doctor Notifications
  const [notifPage, setNotifPage] = useState(1)
  const NOTIFS_PER_PAGE = 8
  const totalNotifPages = Math.ceil(filteredNotifications.length / NOTIFS_PER_PAGE) || 1
  const pagedNotifications = filteredNotifications.slice(
    (notifPage - 1) * NOTIFS_PER_PAGE,
    notifPage * NOTIFS_PER_PAGE,
  )

  const doctorName = doctor?.user?.name || user?.name || 'Doctor'

  const renderNotifIcon = (type?: string) => {
    if (type === 'cancellation') return <AlertCircleIcon size={20} />
    if (type === 'rescheduled') return <RefreshIcon size={20} />
    if (type === 'system') return <SettingsIcon size={20} />
    return <CalendarIcon size={20} />
  }

  const getNotifClass = (type?: string) => {
    if (type === 'cancellation') return 'cancellation'
    if (type === 'rescheduled') return 'rescheduled'
    if (type === 'system') return 'system'
    return 'appointment'
  }

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
              className="dsub-nav-btn"
              onClick={() => navigate('/doctor/patients')}
            >
              <UsersIcon size={16} />
              <span>Patients</span>
              {patientCount > 0 && <span className="dsub-badge-count">{patientCount}</span>}
            </button>
            <button
              type="button"
              className="dsub-nav-btn active"
              onClick={() => navigate('/doctor/notifications')}
            >
              <BellIcon size={16} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="dsub-badge-count unread">{unreadCount}</span>
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
              className="dsub-tab-pill"
              onClick={() => navigate('/doctor/patients')}
            >
              <UsersIcon size={16} /> Recent Patients & Care History
            </button>
            <button
              type="button"
              className="dsub-tab-pill active"
              onClick={() => navigate('/doctor/notifications')}
            >
              <BellIcon size={16} /> Alerts & Notifications
              {unreadCount > 0 && (
                <span className="dsub-badge-count unread" style={{ marginLeft: 4 }}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="dsub-hero">
          <div>
            <span className="dsub-hero-tag">
              <BellIcon size={13} /> Alerts & Clinical Updates
            </span>
            <h1 className="dsub-hero-title">Notifications & Practice Alerts</h1>
            <p className="dsub-hero-desc">
              Stay informed with real-time alerts regarding patient bookings, rescheduling requests,
              cancellations, and clinical notifications.
            </p>
          </div>

          <div className="dsub-hero-stats">
            <div className="dsub-hero-stat-card">
              <div className="dsub-hero-stat-val" style={{ color: unreadCount > 0 ? '#ef4444' : '#0d5c63' }}>
                {loading ? '-' : unreadCount}
              </div>
              <div className="dsub-hero-stat-lbl">Unread Alerts</div>
            </div>
            <div className="dsub-hero-stat-card">
              <div className="dsub-hero-stat-val">{loading ? '-' : notifications.length}</div>
              <div className="dsub-hero-stat-lbl">Total Logged</div>
            </div>
          </div>
        </div>

        {/* Filter Bar & Quick Action */}
        <div className="dsub-filter-bar">
          <div className="dsub-filter-chips">
            <button
              type="button"
              className={`dsub-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('all')
                setNotifPage(1)
              }}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`dsub-chip ${filterType === 'unread' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('unread')
                setNotifPage(1)
              }}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`dsub-chip ${filterType === 'appointment' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('appointment')
                setNotifPage(1)
              }}
            >
              Appointments
            </button>
            <button
              type="button"
              className={`dsub-chip ${filterType === 'rescheduled' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('rescheduled')
                setNotifPage(1)
              }}
            >
              Reschedules
            </button>
            <button
              type="button"
              className={`dsub-chip ${filterType === 'cancellation' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('cancellation')
                setNotifPage(1)
              }}
            >
              Cancellations
            </button>
            <button
              type="button"
              className={`dsub-chip ${filterType === 'system' ? 'active' : ''}`}
              onClick={() => {
                setFilterType('system')
                setNotifPage(1)
              }}
            >
              System
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="dsub-btn-primary"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              <CheckCircleIcon size={16} />
              <span>{markingAll ? 'Marking Read...' : 'Mark All as Read'}</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="dsub-loading-wrap">
            <div className="dsub-spinner" />
            <p>Loading notifications and practice updates...</p>
          </div>
        ) : error ? (
          <div className="dsub-empty-state" style={{ borderColor: '#fca5a5' }}>
            <span className="dsub-empty-icon" style={{ color: '#dc2626', background: '#fef2f2' }}>
              <AlertCircleIcon size={32} />
            </span>
            <h3 className="dsub-empty-title">Error Loading Notifications</h3>
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
        ) : filteredNotifications.length === 0 ? (
          <div className="dsub-empty-state">
            <span className="dsub-empty-icon">
              <BellIcon size={32} />
            </span>
            <h3 className="dsub-empty-title">No notifications found</h3>
            <p className="dsub-empty-desc">
              {filterType === 'unread'
                ? "You're all caught up! There are no unread notifications."
                : 'Any new appointment bookings or patient updates will appear here.'}
            </p>
          </div>
        ) : (
          <div className="dsub-notifications-list">
            {pagedNotifications.map((n) => (
              <div
                key={n._id}
                className={`dsub-notif-card ${!n.isRead ? 'unread' : ''}`}
                onClick={() => !n.isRead && handleMarkRead(n._id)}
                style={{ cursor: !n.isRead ? 'pointer' : 'default' }}
                title={!n.isRead ? 'Click to mark as read' : ''}
              >
                <div className={`dsub-notif-icon-box ${getNotifClass(n.type)}`}>
                  {renderNotifIcon(n.type)}
                </div>

                <div className="dsub-notif-content">
                  <div className="dsub-notif-head">
                    <h4 className="dsub-notif-title">{n.title}</h4>
                    <span className="dsub-notif-time">
                      {n.createdAt
                        ? new Date(n.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recent'}
                    </span>
                  </div>

                  <p className="dsub-notif-msg">{n.message}</p>

                  <div className="dsub-notif-footer">
                    <span className={`dsub-notif-tag ${!n.isRead ? 'unread' : 'read'}`}>
                      {!n.isRead ? '● Unread' : 'Read'}
                    </span>

                    {!n.isRead && (
                      <button
                        type="button"
                        className="dsub-btn-mark-read"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkRead(n._id)
                        }}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalNotifPages > 1 && !loading && (
          <div style={{ marginTop: '28px' }}>
            <Pagination
              currentPage={notifPage}
              totalPages={totalNotifPages}
              totalItems={filteredNotifications.length}
              itemsPerPage={NOTIFS_PER_PAGE}
              onPageChange={(p) => setNotifPage(p)}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default DoctorNotificationsPage
