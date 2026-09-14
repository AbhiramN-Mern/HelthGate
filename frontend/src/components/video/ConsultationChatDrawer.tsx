import React, { useState, useRef, useEffect } from 'react'

export interface ChatAttachment {
  name: string
  url: string // Data URL or storage URL
  type: string // e.g. 'image/jpeg', 'application/pdf'
  size?: number
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: 'doctor' | 'patient' | 'system' | string
  text: string
  attachment?: ChatAttachment | null
  timestamp: string
}

interface ConsultationChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSendMessage: (text: string, attachment?: ChatAttachment | null) => void
  currentUserId?: string
  currentUserRole?: string
  currentUserName?: string
  otherUserName?: string
  otherUserRole?: string
}

const CLINICAL_QUICK_CHIPS = [
  'BP: 120/80 mmHg',
  'Pulse: 72 bpm',
  'Temp: 98.6°F',
  'SpO2: 99%',
  'Fasting Sugar: 95 mg/dL',
  'Reports attached for review',
  'Prescription noted, thank you',
]

export const ConsultationChatDrawer: React.FC<ConsultationChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUserId,
  currentUserRole,
  otherUserName = 'Consultant',
}) => {
  const [inputText, setInputText] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text && !pendingAttachment) return

    onSendMessage(text, pendingAttachment)
    setInputText('')
    setPendingAttachment(null)
    setFileError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to 6MB
    if (file.size > 6 * 1024 * 1024) {
      setFileError('File exceeds 6MB limit. Please choose a smaller file.')
      return
    }

    setFileError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPendingAttachment({
        name: file.name,
        url: dataUrl,
        type: file.type || 'application/octet-stream',
        size: file.size,
      })
    }
    reader.readAsDataURL(file)

    // Reset input value so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <aside
      className="hg-chat-drawer"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '360px',
        maxWidth: '100vw',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(11, 19, 32, 0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0d5c63 0%, #0ea5a4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
            }}
          >
            💬
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>
              Clinical Chat & Reports
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Live in-call consultation with {otherUserName}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            fontSize: '1.1rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Quick Clinical Chips */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        {CLINICAL_QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(chip)}
            style={{
              background: 'rgba(14, 165, 164, 0.14)',
              border: '1px solid rgba(14, 165, 164, 0.3)',
              color: '#2dd4bf',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
          >
            + {chip}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.84rem',
              padding: '24px 16px',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🩺</div>
            <p style={{ margin: 0, fontWeight: 600, color: '#94a3b8' }}>No clinical notes yet</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem' }}>
              Exchange symptoms, vital signs, and test reports securely during this video session.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId ? msg.senderId === currentUserId : msg.senderRole === currentUserRole
            const isDoctor = msg.senderRole === 'doctor'

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                {/* Sender Tag */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '3px',
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                  }}
                >
                  <span style={{ fontWeight: 700, color: isDoctor ? '#38bdf8' : '#2dd4bf' }}>
                    {isDoctor ? `Dr. ${msg.senderName.replace(/^Dr\.?\s*/i, '')}` : msg.senderName}
                  </span>
                  <span>
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMe
                      ? 'linear-gradient(135deg, #0d5c63 0%, #088395 100%)'
                      : 'rgba(30, 41, 59, 0.95)',
                    border: isMe ? '1px solid rgba(14, 165, 164, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  {msg.text && <div>{msg.text}</div>}

                  {/* Attachment Card */}
                  {msg.attachment && (
                    <div style={{ marginTop: msg.text ? '8px' : '0' }}>
                      {msg.attachment.type.startsWith('image/') ? (
                        <div
                          onClick={() => setPreviewImage(msg.attachment!.url)}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: '#000',
                          }}
                        >
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name}
                            style={{
                              width: '100%',
                              maxHeight: '180px',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          <div
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              background: 'rgba(0,0,0,0.7)',
                              color: '#cbd5e1',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            📷 {msg.attachment.name} (Click to expand)
                          </div>
                        </div>
                      ) : (
                        <a
                          href={msg.attachment.url}
                          download={msg.attachment.name}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#38bdf8',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>📄</span>
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {msg.attachment.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>⬇️</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Attachment Chip */}
      {pendingAttachment && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(14, 165, 164, 0.15)',
            borderTop: '1px solid rgba(14, 165, 164, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#2dd4bf',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span>📎</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pendingAttachment.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 800,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* File Size / Type Error */}
      {fileError && (
        <div
          style={{
            padding: '6px 14px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#fca5a5',
            fontSize: '0.74rem',
            borderTop: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          {fileError}
        </div>
      )}

      {/* Message Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(11, 19, 32, 0.85)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {/* Attachment Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '9px 10px',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease',
          }}
          title="Share lab report, scan, or file"
        >
          📎
        </button>

        {/* Textarea */}
        <textarea
          rows={1}
          placeholder="Type clinical note..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '9px 12px',
            color: '#f8fafc',
            fontSize: '0.86rem',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() && !pendingAttachment}
          style={{
            background:
              inputText.trim() || pendingAttachment
                ? 'linear-gradient(135deg, #0d5c63 0%, #0ea5a4 100%)'
                : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 14px',
            color: '#ffffff',
            cursor: inputText.trim() || pendingAttachment ? 'pointer' : 'default',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Send
        </button>
      </form>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={previewImage}
            alt="Preview scan"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            }}
          />
        </div>
      )}
    </aside>
  )
}
