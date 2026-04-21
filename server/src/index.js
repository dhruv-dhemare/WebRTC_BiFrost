import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { config } from './config/index.js'
import { query as dbQuery } from './config/database.js'
import apiRoutes from './routes/index.js'
import roomManager from './services/roomManager.js'
import databaseService from './services/databaseService.js'
import jwtService from './services/jwtService.js'
import { createSecureServer } from './config/ssl.js'

const app = express()
const server = createSecureServer(app)
const wss = new WebSocketServer({ server })

// CORS Configuration - Allow multiple origins for development & production
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.RENDER_EXTERNAL_URL || null
].filter(Boolean) // Remove null values

// Security and WebRTC compatibility headers
app.use((req, res, next) => {
  // CORS headers
  const origin = req.headers.origin
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*')
  }
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Security headers - compatible with Safari/Brave and WebRTC
  res.header('X-Content-Type-Options', 'nosniff')
  res.header('X-Frame-Options', 'SAMEORIGIN')
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  // Allow shared array buffers for WebRTC performance
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  res.header('Cross-Origin-Embedder-Policy', 'require-corp')
  
  // WebRTC specific headers
  res.header('X-Content-Type-Options', 'nosniff; mode=block')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked for origin: ${origin}`)
      callback(null, true) // Allow anyway for development, remove in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Routes
app.use('/api', apiRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Room stats endpoint
app.get('/api/rooms/:roomCode/stats', async (req, res) => {
  try {
    const stats = await databaseService.getRoomStats(req.params.roomCode)
    if (!stats) {
      return res.status(404).json({ error: 'Room not found' })
    }
    res.json(stats)
  } catch (error) {
    console.error('Error fetching room stats:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get room messages endpoint
app.get('/api/rooms/:roomCode/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const messages = await databaseService.getMessages(req.params.roomCode, limit)
    res.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('✓ WebSocket client connected')
  let clientRoomId = null
  let clientPeerId = null
  let clientToken = null

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    payload: { message: 'Connected to signaling server' } 
  }))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data)
      console.log(`📨 Received: ${message.type}`)

      switch (message.type) {
        case 'create':
          // Create new room and join it
          const newRoomId = roomManager.createRoom()
          const joinedCreate = roomManager.joinRoom(newRoomId, ws)
          
          if (joinedCreate) {
            clientRoomId = newRoomId
            clientPeerId = message.payload?.peerId || `peer_${Date.now()}`
            clientToken = jwtService.generateToken(newRoomId, clientPeerId)
            
            // Log to database
            databaseService.createRoom(newRoomId, clientPeerId).catch(err => console.error('DB error:', err))
            databaseService.createSession(newRoomId, clientPeerId, true).catch(err => console.error('DB error:', err))
            databaseService.logEvent(newRoomId, 'room_created', { creator: clientPeerId }).catch(err => console.error('DB error:', err))
            
            ws.send(JSON.stringify({
              type: 'room_created',
              payload: { 
                roomId: newRoomId,
                token: clientToken,
                message: 'Room created successfully',
                clientCount: 1
              }
            }))
          }
          break

        case 'join':
          const roomId = message.payload.roomId
          const joined = roomManager.joinRoom(roomId, ws)
          
          if (joined) {
            clientRoomId = roomId
            clientPeerId = message.payload?.peerId || `peer_${Date.now()}`
            clientToken = jwtService.generateToken(roomId, clientPeerId)
            
            const room = roomManager.getRoom(roomId)
            const clientCount = room.clients.size
            
            // Log to database
            databaseService.createSession(roomId, clientPeerId, false).catch(err => console.error('DB error:', err))
            databaseService.logEvent(roomId, 'peer_joined', { peerId: clientPeerId }).catch(err => console.error('DB error:', err))
            
            // Notify joiner
            ws.send(JSON.stringify({
              type: 'join_confirmed',
              payload: { 
                roomId: roomId,
                token: clientToken,
                message: 'Successfully joined room',
                clientCount: clientCount
              }
            }))

            // Notify other client in room (if exists)
            if (clientCount === 2) {
              const otherClients = roomManager.getClients(roomId).filter(c => c !== ws)
              otherClients.forEach(other => {
                other.send(JSON.stringify({
                  type: 'peer_joined',
                  payload: { 
                    roomId: roomId, 
                    message: 'Another peer joined the room',
                    clientCount: clientCount
                  }
                }))
              })
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { message: 'Failed to join room. Room not found or full.' }
            }))
          }
          break

        case 'chat_message':
          if (clientRoomId) {
            // Log message to database
            databaseService.saveMessage(clientRoomId, clientPeerId, message.payload.text, 'text').catch(err => console.error('DB error:', err))
            
            const room = roomManager.getRoom(clientRoomId)
            const otherClients = roomManager.getClients(clientRoomId).filter(c => c !== ws)
            otherClients.forEach(other => {
              other.send(JSON.stringify({
                type: 'chat_message',
                payload: {
                  text: message.payload.text,
                  timestamp: Date.now()
                }
              }))
            })
          }
          break

        // WebRTC Signaling Messages
        case 'offer':
          if (clientRoomId) {
            console.log(`📤 Offer relayed in room ${clientRoomId}`)
            const otherClients = roomManager.getClients(clientRoomId).filter(c => c !== ws)
            otherClients.forEach(other => {
              other.send(JSON.stringify({
                type: 'offer',
                payload: message.payload // { sdp }
              }))
            })
          }
          break

        case 'answer':
          if (clientRoomId) {
            console.log(`📥 Answer relayed in room ${clientRoomId}`)
            const otherClients = roomManager.getClients(clientRoomId).filter(c => c !== ws)
            otherClients.forEach(other => {
              other.send(JSON.stringify({
                type: 'answer',
                payload: message.payload // { sdp }
              }))
            })
          }
          break

        case 'ice_candidate':
          if (clientRoomId) {
            console.log(`❄️ ICE candidate relayed in room ${clientRoomId}`)
            const otherClients = roomManager.getClients(clientRoomId).filter(c => c !== ws)
            otherClients.forEach(other => {
              other.send(JSON.stringify({
                type: 'ice_candidate',
                payload: message.payload // { candidate, sdpMLineIndex, sdpMid }
              }))
            })
          }
          break

        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            payload: { timestamp: Date.now() }
          }))
          break

        default:
          console.log(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Server error processing message' }
      }))
    }
  })

  ws.on('close', () => {
    console.log('✗ WebSocket client disconnected')
    if (clientRoomId) {
      roomManager.leaveRoom(ws)
      
      // Log disconnect to database
      if (clientPeerId) {
        databaseService.endSession(clientPeerId, clientRoomId).catch(err => console.error('DB error:', err))
        databaseService.logEvent(clientRoomId, 'peer_left', { peerId: clientPeerId }).catch(err => console.error('DB error:', err))
      }
      
      // Notify remaining clients in room
      const room = roomManager.getRoom(clientRoomId)
      if (room) {
        room.clients.forEach(client => {
          client.send(JSON.stringify({
            type: 'peer_left',
            payload: { 
              roomId: clientRoomId,
              clientCount: room.clients.size
            }
          }))
        })
      }
      
      // Close room if empty
      if (!room || room.clients.size === 0) {
        databaseService.closeRoom(clientRoomId).catch(err => console.error('DB error:', err))
      }
    }
  })

  ws.on('error', (error) => {
    console.error('✗ WebSocket error:', error)
  })
})

// Periodic cleanup of old rooms (every hour)
setInterval(() => {
  databaseService.cleanupOldRooms(24).catch(err => console.error('Cleanup error:', err))
}, 60 * 60 * 1000)

// Start server with error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error)
  process.exit(1)
})

server.listen(config.port, () => {
  console.log(`✓ Server running on http://localhost:${config.port}`)
  console.log(`✓ WebSocket server ready on ws://localhost:${config.port}`)
  console.log(`✓ Environment: ${config.nodeEnv}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close()
})

// Catch any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})
