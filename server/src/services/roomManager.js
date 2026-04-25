// Room Manager - Handles room creation, joining, and client tracking for multi-user WebRTC
import fs from 'fs'
import path from 'path'

class RoomManager {
  constructor() {
    this.rooms = new Map() // roomId -> { users: Map<wsClient, {name, clientId}>, createdAt, userCount }
    this.userRooms = new Map() // wsClient -> roomId
    this.clientIds = new Map() // wsClient -> clientId (unique identifier for each connection)
    
    // File-based persistence
    this.roomsFile = path.join(process.cwd(), 'data', 'rooms.json')
    this.ensureDataDir()
    this.loadRoomsFromDisk()
  }

  // Ensure data directory exists
  ensureDataDir() {
    const dataDir = path.dirname(this.roomsFile)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
      console.log(`📁 Created data directory: ${dataDir}`)
    }
  }

  // Load rooms from disk (on startup)
  loadRoomsFromDisk() {
    try {
      if (fs.existsSync(this.roomsFile)) {
        const data = fs.readFileSync(this.roomsFile, 'utf-8')
        const savedRooms = JSON.parse(data)
        
        // Restore rooms to memory, but only if created recently (< 1 hour)
        const oneHourAgo = Date.now() - 3600000
        let restored = 0
        
        for (const [roomId, roomData] of Object.entries(savedRooms)) {
          if (roomData.createdAt > oneHourAgo) {
            this.rooms.set(roomId, {
              users: new Map(),
              createdAt: roomData.createdAt,
              userCount: 0,
              preserved: true
            })
            restored++
          }
        }
        
        console.log(`📂 Loaded ${restored} rooms from disk (${this.rooms.size} total active)`)
      }
    } catch (err) {
      console.warn('⚠️ Could not load rooms from disk:', err.message)
    }
  }

  // Save rooms to disk
  saveRoomsToDisk() {
    try {
      const roomsData = {}
      
      for (const [roomId, room] of this.rooms.entries()) {
        roomsData[roomId] = {
          createdAt: room.createdAt,
          userCount: room.userCount,
          preserved: room.preserved || false
        }
      }
      
      fs.writeFileSync(this.roomsFile, JSON.stringify(roomsData, null, 2))
    } catch (err) {
      console.error('❌ Failed to save rooms to disk:', err.message)
    }
  }

  // Generate unique room ID
  generateRoomId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase()
  }

  // Generate unique client ID
  generateClientId() {
    return 'user_' + Math.random().toString(36).substr(2, 9)
  }

  // Create a new room
  createRoom() {
    const roomId = this.generateRoomId()
    this.rooms.set(roomId, {
      users: new Map(), // wsClient -> {name, clientId, joinedAt}
      createdAt: Date.now(),
      userCount: 0
    })
    
    // Persist to disk immediately
    this.saveRoomsToDisk()
    
    console.log(`🏠 Room created: ${roomId} (${this.rooms.size} active)`)
    return roomId
  }

  // Join a room
  joinRoom(roomId, ws, userName) {
    // List available rooms for debugging
    console.log(`📋 Available rooms: ${Array.from(this.rooms.keys()).join(', ') || 'NONE'}`)
    
    if (!this.rooms.has(roomId)) {
      console.error(`❌ Room not found: ${roomId}. Available: ${Array.from(this.rooms.keys()).join(', ') || 'NONE'}`)
      return { success: false, error: 'Room not found' }
    }

    const room = this.rooms.get(roomId)
    
    // Check if room is full (max 6 users)
    if (room.users.size >= 6) {
      console.warn(`❌ Room full: ${roomId} (${room.users.size}/6)`)
      return { success: false, error: 'Room is full' }
    }

    const clientId = this.generateClientId()
    room.users.set(ws, {
      name: userName || `User${room.users.size + 1}`,
      clientId,
      joinedAt: Date.now()
    })
    room.userCount = room.users.size
    
    this.userRooms.set(ws, roomId)
    this.clientIds.set(ws, clientId)
    
    console.log(`👥 Client "${userName}" joined room ${roomId} (${room.users.size}/6 users)`)
    
    return { success: true, clientId, userCount: room.users.size, users: this.getRoomUsers(roomId) }
  }

  // Leave a room
  leaveRoom(ws) {
    const roomId = this.userRooms.get(ws)
    if (!roomId) return null

    const room = this.rooms.get(roomId)
    if (room) {
      const userName = room.users.get(ws)?.name
      room.users.delete(ws)
      room.userCount = room.users.size
      console.log(`👤 Client "${userName}" left room ${roomId} (${room.users.size}/6 remaining)`)

      // Delete room if empty
      if (room.users.size === 0) {
        this.rooms.delete(roomId)
        console.log(`🗑️ Room deleted: ${roomId}`)
      }
      
      // Persist changes
      this.saveRoomsToDisk()
    }

    this.userRooms.delete(ws)
    this.clientIds.delete(ws)
    return roomId
  }

  // Get room info
  getRoom(roomId) {
    return this.rooms.get(roomId)
  }

  // Get all users in a room with their details
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return []
    
    return Array.from(room.users.entries()).map(([ws, userData]) => ({
      clientId: userData.clientId,
      name: userData.name,
      joinedAt: userData.joinedAt
    }))
  }

  // Get clients (WebSocket connections) in a room
  getClients(roomId) {
    const room = this.rooms.get(roomId)
    return room ? Array.from(room.users.keys()) : []
  }

  // Get room ID for a client
  getRoomId(ws) {
    return this.userRooms.get(ws)
  }

  // Get client ID for a WebSocket connection
  getClientId(ws) {
    return this.clientIds.get(ws)
  }

  // Get user info for a client
  getUserInfo(ws) {
    const roomId = this.userRooms.get(ws)
    if (!roomId) return null
    
    const room = this.rooms.get(roomId)
    return room?.users.get(ws) || null
  }

  // Broadcast to all clients in a room except sender
  broadcast(roomId, message, excludeWs = null) {
    const room = this.rooms.get(roomId)
    if (!room) return

    const msgString = JSON.stringify(message)
    room.users.forEach((userData, client) => {
      if (excludeWs && client === excludeWs) return
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(msgString)
      }
    })
  }

  // Send to specific client in room
  send(roomId, message, targetWs) {
    const room = this.rooms.get(roomId)
    if (!room || !room.users.has(targetWs)) return

    if (targetWs.readyState === 1) {
      targetWs.send(JSON.stringify(message))
    }
  }

  // Send to all except sender (for when sender is included)
  broadcastToAll(roomId, message) {
    const room = this.rooms.get(roomId)
    if (!room) return

    const msgString = JSON.stringify(message)
    room.users.forEach((userData, client) => {
      if (client.readyState === 1) {
        client.send(msgString)
      }
    })
  }

  // Get room stats
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalClients: this.userRooms.size,
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        users: room.users.size,
        maxUsers: 6,
        createdAt: new Date(room.createdAt).toISOString(),
        userDetails: Array.from(room.users.values()).map(u => ({ name: u.name, clientId: u.clientId }))
      }))
    }
  }

  // Check if room is full
  isRoomFull(roomId) {
    const room = this.rooms.get(roomId)
    return room && room.users.size >= 6
  }

  // Get room capacity info
  getRoomCapacity(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return null
    return {
      current: room.users.size,
      max: 6,
      available: 6 - room.users.size,
      isFull: room.users.size >= 6
    }
  }

  // Clean up old rooms (older than 24 hours)
  cleanupOldRooms(maxAgeMs = 86400000) {
    const now = Date.now()
    let removed = 0

    for (const [roomId, room] of this.rooms.entries()) {
      // Only delete empty rooms or rooms older than maxAge
      if (room.users.size === 0 && now - room.createdAt > maxAgeMs) {
        this.rooms.delete(roomId)
        removed++
      }
    }

    if (removed > 0) {
      this.saveRoomsToDisk()
      console.log(`🧹 Cleaned up ${removed} old rooms`)
    }

    return removed
  }

  // Periodic cleanup - call this from server setup
  startCleanupInterval(intervalMs = 3600000) {
    setInterval(() => {
      this.cleanupOldRooms()
    }, intervalMs)
    console.log(`🔄 Room cleanup scheduled every ${intervalMs / 1000} seconds`)
  }
}

export default new RoomManager()
