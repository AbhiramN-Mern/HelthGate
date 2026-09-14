interface CallControlsProps {
  isAudioMuted: boolean
  isVideoMuted: boolean
  callDuration: number
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
  disabled?: boolean
  isChatOpen?: boolean
  unreadChatCount?: number
  onToggleChat?: () => void
}

export const CallControls = ({
  isAudioMuted,
  isVideoMuted,
  callDuration,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  disabled = false,
  isChatOpen = false,
  unreadChatCount = 0,
  onToggleChat,
}: CallControlsProps) => {
  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="hg-call-controls-bar">
      {/* Call Timer */}
      <div className="hg-call-duration-badge" title="Consultation duration">
        <span className="hg-timer-dot">●</span>
        <span>{formatDuration(callDuration)}</span>
      </div>

      {/* Primary Action Buttons */}
      <div className="hg-controls-buttons-group">
        {/* Microphone Toggle */}
        <button
          type="button"
          onClick={onToggleAudio}
          disabled={disabled}
          className={`hg-control-btn ${isAudioMuted ? 'muted' : 'active'}`}
          title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          <span className="hg-btn-label">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleVideo}
          disabled={disabled}
          className={`hg-control-btn ${isVideoMuted ? 'muted' : 'active'}`}
          title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          aria-label={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21l-4.35-4.35M23 7l-7 5 7 5V7z" />
              <path d="M10.5 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
          <span className="hg-btn-label">{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
        </button>

        {/* Clinical Chat & Reports Toggle */}
        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            className={`hg-control-btn ${isChatOpen ? 'active' : ''}`}
            title="Clinical Chat & Lab Reports"
            aria-label="Clinical Chat & Lab Reports"
            style={{ position: 'relative' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadChatCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                }}
              >
                {unreadChatCount}
              </span>
            )}
            <span className="hg-btn-label">Chat</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          onClick={onEndCall}
          className="hg-control-btn end-call"
          title="End Consultation Call"
          aria-label="End Consultation Call"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
          <span className="hg-btn-label">End Call</span>
        </button>
      </div>
    </div>
  )
}
