import { io, Socket } from 'socket.io-client'

const SOCKET_SERVER_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : 'http://localhost:5000')

let socketInstance: Socket | null = null

export const getSocket = (token?: string): Socket => {
  const activeToken =
    token ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('helthgate_token')
      : null)

  if (socketInstance && socketInstance.connected) {
    return socketInstance
  }

  if (socketInstance) {
    socketInstance.disconnect()
  }

  socketInstance = io(SOCKET_SERVER_URL, {
    auth: {
      token: activeToken,
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socketInstance.on('connect', () => {
    console.log('[SocketService] Connected to signaling server with ID:', socketInstance?.id)
  })

  socketInstance.on('connect_error', (error) => {
    console.warn('[SocketService] Connection error:', error.message)
  })

  socketInstance.on('disconnect', (reason) => {
    console.log('[SocketService] Disconnected:', reason)
  })

  return socketInstance
}

export const disconnectSocket = () => {
  if (socketInstance) {
    console.log('[SocketService] Disconnecting socket')
    socketInstance.disconnect()
    socketInstance = null
  }
}
