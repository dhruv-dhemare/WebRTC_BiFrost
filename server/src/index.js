import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { config } from './config/index.js'
import { query as dbQuery } from './config/database.js'
import apiRoutes from './routes/index.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', apiRoutes)

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected')

  ws.on('close', () => {
    console.log('WebSocket client disconnected')
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

// Start server
server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`)
  console.log(`WebSocket server ready on ws://localhost:${config.port}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close()
})
