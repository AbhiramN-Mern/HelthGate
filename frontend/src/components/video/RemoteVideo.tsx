import { useEffect, useRef } from 'react'
import type { WebRTCConnectionState } from '../../hooks/useWebRTC'

interface RemoteVideoProps {
  stream: MediaStream | null
  connectionState: WebRTCConnectionState
  remoteUserName?: string
  remoteUserRole?: 'patient' | 'doctor'
  specialization?: string
}

export const RemoteVideo = ({
  stream,
  connectionState,
  remoteUserName = 'Participant',
  remoteUserRole = 'doctor',
  specialization,
}: RemoteVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Attach stream and trigger play whenever stream or connectionState changes
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream
      }
      video.play().catch((err) => {
        console.warn('[RemoteVideo] Auto-play was prevented by browser:', err)
      })
    }
  }, [stream, connectionState])

  const isConnected = connectionState === 'connected' && !!stream
  const roleLabel = remoteUserRole === 'doctor' ? 'Doctor' : 'Patient'

  return (
    <div className="hg-remote-video-stage">
      {/* Video element is permanently mounted to prevent ref nulling and track detachment */}
      <video
        ref={(el) => {
          videoRef.current = el
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream
            el.play().catch(() => {})
          }
        }}
        autoPlay
        playsInline
        style={{ display: isConnected ? 'block' : 'none' }}
        className="hg-remote-video-element"
      />

      {!isConnected && (
        <div className="hg-remote-waiting-card">
          <div className="hg-waiting-pulse-wrap">
            <div className="hg-pulse-ring"></div>
            <div className="hg-pulse-ring delay"></div>
            <div className="hg-waiting-avatar">
              {remoteUserName.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase() || 'P'}
            </div>
          </div>

          <div className="hg-waiting-info">
            {connectionState === 'connecting' ? (
              <>
                <h3 className="hg-waiting-title">Connecting to {remoteUserName}...</h3>
                <p className="hg-waiting-desc">Establishing secure encrypted WebRTC peer connection.</p>
              </>
            ) : connectionState === 'reconnecting' ? (
              <>
                <h3 className="hg-waiting-title">Reconnecting with {remoteUserName}...</h3>
                <p className="hg-waiting-desc">Network connection interrupted. Attempting to restore session...</p>
              </>
            ) : connectionState === 'failed' ? (
              <>
                <h3 className="hg-waiting-title">Connection Unsuccessful</h3>
                <p className="hg-waiting-desc">Unable to establish direct peer stream. Please check your network.</p>
              </>
            ) : (
              <>
                <h3 className="hg-waiting-title">
                  Waiting for the {roleLabel.toLowerCase()} to join...
                </h3>
                <p className="hg-waiting-desc">
                  You are in the secure consultation room. As soon as {remoteUserName} enters, video and audio will automatically connect.
                </p>
              </>
            )}

            {specialization && (
              <span className="hg-waiting-spec-badge">
                {specialization}
              </span>
            )}
          </div>

          <div className="hg-waiting-tips">
            <div className="hg-tip-item">
              <span className="hg-tip-icon">✓</span>
              <span>Position camera at eye level with adequate front lighting</span>
            </div>
            <div className="hg-tip-item">
              <span className="hg-tip-icon">✓</span>
              <span>Use earphones to reduce microphone audio feedback</span>
            </div>
            <div className="hg-tip-item">
              <span className="hg-tip-icon">✓</span>
              <span>Keep prescriptions or previous reports within reach</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Indicator Tag on the remote feed */}
      {isConnected && (
        <div className="hg-remote-info-bar">
          <div className="hg-remote-identity">
            <span className="hg-remote-dot-live">●</span>
            <span className="hg-remote-name">{remoteUserName}</span>
            {specialization && <span className="hg-remote-spec">• {specialization}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
