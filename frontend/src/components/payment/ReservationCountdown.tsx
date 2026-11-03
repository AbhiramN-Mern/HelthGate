import React, { useEffect, useState, useRef } from 'react'
import { ClockIcon, AlertCircleIcon } from '../common/Icons'

export type ReservationCountdownProps = {
  expiresAt?: string | Date | null
  onExpire?: () => void
  compact?: boolean
  showWarningNotice?: boolean
}

export const ReservationCountdown: React.FC<ReservationCountdownProps> = ({
  expiresAt,
  onExpire,
  compact = false,
  showWarningNotice = true,
}) => {
  const calculateRemaining = () => {
    if (!expiresAt) return 0
    const target = new Date(expiresAt).getTime()
    if (isNaN(target)) return 0
    const diff = Math.floor((target - Date.now()) / 1000)
    return diff > 0 ? diff : 0
  }

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemaining)
  const expiredHandledRef = useRef<boolean>(false)

  useEffect(() => {
    expiredHandledRef.current = false
    setRemainingSeconds(calculateRemaining())

    const interval = setInterval(() => {
      const remaining = calculateRemaining()
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        if (!expiredHandledRef.current) {
          expiredHandledRef.current = true
          onExpire?.()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const mins = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const isExpired = remainingSeconds <= 0
  const isExpiringSoon = !isExpired && remainingSeconds <= 120

  if (compact) {
    if (isExpired) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: '#dc2626',
            background: '#fee2e2',
            padding: '2px 8px',
            borderRadius: '6px',
            border: '1px solid #fca5a5',
          }}
        >
          <ClockIcon size={12} /> Expired (00:00)
        </span>
      )
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.74rem',
          fontWeight: 700,
          color: isExpiringSoon ? '#b45309' : '#0369a1',
          background: isExpiringSoon ? '#fef3c7' : '#e0f2fe',
          padding: '2px 8px',
          borderRadius: '6px',
          border: `1px solid ${isExpiringSoon ? '#fde68a' : '#bae6fd'}`,
        }}
      >
        <ClockIcon size={12} /> {formattedTime} left
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        margin: '8px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '8px',
          background: isExpired ? '#fef2f2' : isExpiringSoon ? '#fffbeb' : '#f0f9ff',
          border: `1px solid ${isExpired ? '#fecaca' : isExpiringSoon ? '#fde68a' : '#bae6fd'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClockIcon
            size={14}
            color={isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : '#0284c7'}
          />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: isExpired ? '#991b1b' : isExpiringSoon ? '#92400e' : '#0369a1',
            }}
          >
            {isExpired ? 'Reservation Hold Expired' : 'Temporary 5-Min Hold'}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'monospace, monospace',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: isExpired ? '#dc2626' : isExpiringSoon ? '#b45309' : '#0369a1',
            letterSpacing: '0.5px',
          }}
        >
          {formattedTime}
        </span>
      </div>

      {showWarningNotice && isExpiringSoon && !isExpired && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: '#92400e',
            background: '#fffbeb',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #fef3c7',
          }}
        >
          <AlertCircleIcon size={13} />
          <span>Reservation expiring soon! Please complete payment within {formattedTime} to secure this slot.</span>
        </div>
      )}

      {isExpired && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: '#b91c1c',
            background: '#fef2f2',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #fee2e2',
          }}
        >
          <AlertCircleIcon size={13} />
          <span>Payment window elapsed. This appointment slot has been released.</span>
        </div>
      )}
    </div>
  )
}

