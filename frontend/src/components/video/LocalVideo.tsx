import { useEffect, useRef } from 'react'

interface LocalVideoProps {
  stream: MediaStream | null
  isAudioMuted: boolean
  isVideoMuted: boolean
  userName?: string
}

export const LocalVideo = ({
  stream,
  isAudioMuted,
  isVideoMuted,
  userName = 'You',
}: LocalVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Attach stream and trigger play whenever stream or mute state changes
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream
      }
      video.play().catch((err) => {
        console.warn('[LocalVideo] Auto-play was prevented by browser:', err)
      })
    }
  }, [stream, isVideoMuted])

  const hasActiveVideoStream =
    stream &&
    !isVideoMuted &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.enabled)

  return (
    <div className="hg-local-video-container">
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
        muted
        style={{ display: hasActiveVideoStream ? 'block' : 'none' }}
        className="hg-local-video-element"
      />

      {/* Fallback avatar placeholder when camera is off or stream is still loading */}
      {!hasActiveVideoStream && (
        <div className="hg-local-video-placeholder">
          <div className="hg-avatar-circle">
            {userName.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="hg-camera-off-text">
            {!stream ? 'Connecting camera...' : 'Camera Off'}
          </span>
        </div>
      )}

      <div className="hg-local-video-overlay">
        <span className="hg-local-name-tag">{userName} (You)</span>
        <div className="hg-local-badges">
          {isAudioMuted && <span className="hg-badge-muted" title="Microphone muted">🔇 Muted</span>}
        </div>
      </div>
    </div>
  )
}

