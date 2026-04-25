// Multi-Peer WebRTC Connection Manager
import ws from './websocket'

class MultiPeerManager {
  constructor() {
    this.peers = new Map() // peerId -> { connection, dataChannels, remoteStream, userName }
    this.localStream = null
    this.listeners = {}
    this.iceCandidateQueue = new Map() // peerId -> [candidates]
    this.iceServers = [
      // Primary STUN servers (Google)
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] },
      { urls: ['stun:stun2.l.google.com:19302'] },
      { urls: ['stun:stun3.l.google.com:19302'] },
      { urls: ['stun:stun4.l.google.com:19302'] },
      
      // Fallback STUN servers
      { urls: ['stun:stunserver.org:3478'] },
      { urls: ['stun:stun.l.google.com:5349'] },
      
      // Primary TURN servers with UDP/TCP/TLS options
      {
        urls: ['turn:openrelay.metered.ca:80'],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: ['turn:openrelay.metered.ca:443'],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: ['turn:openrelay.metered.ca:443?transport=tcp'],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }

  // Initialize connection with a specific peer
  initializePeerConnection(peerId, isInitiator = false, userName = 'Unknown') {
    console.log(`🔌 Initializing peer connection with ${peerId} (${isInitiator ? 'initiator' : 'responder'})`)

    if (this.peers.has(peerId)) {
      console.log(`Peer ${peerId} already exists, skipping initialization`)
      return
    }

    // Detect browser for specific configuration
    const userAgent = navigator.userAgent
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent)
    const isBrave = /Brave/.test(userAgent)

    const config = {
      iceServers: this.iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 0
    }

    const peerConnection = new RTCPeerConnection(config)
    
    // Initialize peer data
    const peerData = {
      connection: peerConnection,
      dataChannels: new Map(), // label -> dataChannel
      remoteStream: null,
      userName: userName,
      isInitiator: isInitiator,
      offerSent: false,
      answerSent: false
    }

    // Add local stream tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream)
      })
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate
        console.log(`❄️ ICE candidate for ${peerId}: ${candidate.candidate.split(' ')[7] || 'N/A'}`)
        
        ws.send('ice_candidate', {
          targetId: peerId,
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          usernameFragment: event.candidate.usernameFragment
        })
      } else {
        console.log(`❄️ ICE gathering complete for ${peerId}`)
        this.emit('ice_gathering_complete', { peerId })
      }
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${peerId}: ${peerConnection.connectionState}`)
      this.emit('connection_state_change', { peerId, state: peerConnection.connectionState })

      if (peerConnection.connectionState === 'connected') {
        this.emit('peer_connected', { peerId, userName })
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        this.emit('peer_disconnected', { peerId, userName })
      }
    }

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`❄️ ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`)
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log(`🎥 Remote track received from ${peerId}:`, event.track.kind)
      
      if (!peerData.remoteStream) {
        peerData.remoteStream = new MediaStream()
      }
      
      peerData.remoteStream.addTrack(event.track)
      this.emit('remote_stream', { peerId, stream: peerData.remoteStream, userName })
    }

    // Handle data channels (when peer opens them)
    peerConnection.ondatachannel = (event) => {
      console.log(`📢 Data channel received from ${peerId}: ${event.channel.label}`)
      this.setupDataChannel(peerId, event.channel)
    }

    this.peers.set(peerId, peerData)
    
    // Emit peer_initialized event immediately (not waiting for connection)
    this.emit('peer_initialized', { peerId, userName, isInitiator })
    console.log(`✓ Peer initialized: ${peerId} (${userName}) as ${isInitiator ? 'initiator' : 'responder'}`)

    // If we're the initiator, create the offer
    if (isInitiator) {
      this.createAndSendOffer(peerId)
    }

    return peerConnection
  }

  // Create and send offer
  async createAndSendOffer(peerId) {
    const peerData = this.peers.get(peerId)
    if (!peerData) return

    try {
      // Create data channels for initiator
      this.createDataChannel(peerId, 'chat')
      this.createDataChannel(peerId, 'files')

      const offer = await peerData.connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })

      await peerData.connection.setLocalDescription(offer)
      peerData.offerSent = true

      console.log(`📤 Sending offer to ${peerId}`)
      ws.send('offer', {
        targetId: peerId,
        sdp: peerData.connection.localDescription.sdp
      })
    } catch (error) {
      console.error(`Error creating offer for ${peerId}:`, error)
    }
  }

  // Handle incoming offer
  async handleOffer(peerId, sdp, userName) {
    let peerData = this.peers.get(peerId)
    
    // Initialize if not already done
    if (!peerData) {
      peerData = this.initializePeerConnection(peerId, false, userName)
      if (!peerData) peerData = this.peers.get(peerId)
    }

    try {
      await peerData.connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      console.log(`📤 Received offer from ${peerId}, sending answer`)

      // NOTE: Responder MUST NOT create data channels - only initiator does
      // Responder receives them via ondatachannel event
      // Creating them on both sides causes conflicts and channels won't work

      const answer = await peerData.connection.createAnswer()
      await peerData.connection.setLocalDescription(answer)
      peerData.answerSent = true

      ws.send('answer', {
        targetId: peerId,
        sdp: peerData.connection.localDescription.sdp
      })
    } catch (error) {
      console.error(`Error handling offer from ${peerId}:`, error)
    }
  }

  // Handle incoming answer
  async handleAnswer(peerId, sdp) {
    const peerData = this.peers.get(peerId)
    if (!peerData) {
      console.warn(`Peer ${peerId} not found when handling answer`)
      return
    }

    try {
      await peerData.connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      console.log(`📥 Received answer from ${peerId}`)
    } catch (error) {
      console.error(`Error handling answer from ${peerId}:`, error)
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(peerId, candidate, sdpMLineIndex, sdpMid, usernameFragment) {
    const peerData = this.peers.get(peerId)
    
    if (!peerData) {
      console.log(`Queueing ICE candidate for ${peerId}`)
      if (!this.iceCandidateQueue.has(peerId)) {
        this.iceCandidateQueue.set(peerId, [])
      }
      this.iceCandidateQueue.get(peerId).push({ candidate, sdpMLineIndex, sdpMid, usernameFragment })
      return
    }

    try {
      await peerData.connection.addIceCandidate(
        new RTCIceCandidate({ candidate, sdpMLineIndex, sdpMid, usernameFragment })
      )
      console.log(`❄️ Added ICE candidate for ${peerId}`)
    } catch (error) {
      console.error(`Error adding ICE candidate for ${peerId}:`, error)
    }
  }

  // Create data channel
  createDataChannel(peerId, label) {
    const peerData = this.peers.get(peerId)
    if (!peerData || peerData.dataChannels.has(label)) return

    const dataChannel = peerData.connection.createDataChannel(label, {
      ordered: true
    })

    this.setupDataChannel(peerId, dataChannel)
    return dataChannel
  }

  // Setup data channel (both for created and received channels)
  setupDataChannel(peerId, dataChannel) {
    const peerData = this.peers.get(peerId)
    if (!peerData) return

    peerData.dataChannels.set(dataChannel.label, dataChannel)

    dataChannel.onopen = () => {
      console.log(`📢 Data channel opened: ${dataChannel.label} for ${peerId}`)
      this.emit('data_channel_open', { peerId, label: dataChannel.label })
    }

    dataChannel.onclose = () => {
      console.log(`📢 Data channel closed: ${dataChannel.label} for ${peerId}`)
      peerData.dataChannels.delete(dataChannel.label)
      this.emit('data_channel_close', { peerId, label: dataChannel.label })
    }

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log(`📢 Data channel message from ${peerId}:`, message)
        this.emit('data_channel_message', { peerId, message, label: dataChannel.label })
        
        // Emit specific events based on message type
        if (message.type === 'text') {
          this.emit('text_message', { peerId, text: message.text })
        } else if (message.type === 'file') {
          this.emit('file_chunk', { peerId, data: message })
        }
      } catch (error) {
        console.error(`Error parsing message from ${peerId}:`, error)
        this.emit('data_channel_message', { peerId, message: event.data, label: dataChannel.label })
      }
    }

    dataChannel.onerror = (error) => {
      console.error(`📢 Data channel error for ${peerId}:`, error)
      this.emit('data_channel_error', { peerId, error, label: dataChannel.label })
    }
  }

  // Send message on data channel
  sendMessage(peerId, label = 'chat', message) {
    const peerData = this.peers.get(peerId)
    if (!peerData) {
      console.warn(`Peer ${peerId} not found`)
      return false
    }

    const dataChannel = peerData.dataChannels.get(label)
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Data channel ${label} not open for ${peerId}`)
      return false
    }

    try {
      const msgData = typeof message === 'string' ? { type: 'text', text: message } : message
      dataChannel.send(JSON.stringify(msgData))
      return true
    } catch (error) {
      console.error(`Error sending message to ${peerId}:`, error)
      return false
    }
  }

  // Get user media
  async getUserMedia(constraints) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      return this.localStream
    } catch (error) {
      console.error('Error getting user media:', error)
      throw error
    }
  }

  // Stop local stream
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }
  }

  // Send file to all peers or specific peer
  async sendFile(file, targetPeerId = null) {
    console.log(`📁 Sending file: ${file.name}`)
    
    const peersToSend = targetPeerId 
      ? [targetPeerId] 
      : Array.from(this.peers.keys())

    for (const peerId of peersToSend) {
      try {
        await this._sendFileToPeer(peerId, file)
      } catch (error) {
        console.error(`Error sending file to ${peerId}:`, error)
      }
    }
  }

  // Send file to specific peer
  async _sendFileToPeer(peerId, file) {
    const chunkSize = 16384 // 16KB chunks
    const fileData = new Uint8Array(await file.arrayBuffer())
    const totalChunks = Math.ceil(fileData.length / chunkSize)
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Send file metadata
    this.sendMessage(peerId, 'files', {
      type: 'file_start',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      mimeType: file.type
    })

    // Send file chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, fileData.length)
      const chunk = fileData.slice(start, end)

      this.sendMessage(peerId, 'files', {
        type: 'file_chunk',
        fileId,
        chunkIndex: i,
        data: Array.from(chunk)
      })

      // Emit progress
      const progress = ((i + 1) / totalChunks) * 100
      this.emit('file_send_progress', { peerId, fileId, fileName: file.name, progress })
    }

    // Send completion message
    this.sendMessage(peerId, 'files', {
      type: 'file_end',
      fileId,
      fileName: file.name
    })

    this.emit('file_sent', { peerId, fileId, fileName: file.name })
  }

  // Get peer info
  getPeerInfo(peerId) {
    const peerData = this.peers.get(peerId)
    if (!peerData) return null

    return {
      peerId,
      userName: peerData.userName,
      connectionState: peerData.connection.connectionState,
      iceConnectionState: peerData.connection.iceConnectionState,
      remoteStream: peerData.remoteStream,
      dataChannels: Array.from(peerData.dataChannels.keys())
    }
  }

  // Get all peers
  getAllPeers() {
    return Array.from(this.peers.entries()).map(([peerId, peerData]) => ({
      peerId,
      userName: peerData.userName,
      connectionState: peerData.connection.connectionState,
      remoteStream: peerData.remoteStream
    }))
  }

  // Close peer connection
  closePeer(peerId) {
    const peerData = this.peers.get(peerId)
    if (!peerData) return

    // Close all data channels
    peerData.dataChannels.forEach(channel => {
      if (channel.readyState !== 'closed') {
        channel.close()
      }
    })

    // Close peer connection
    if (peerData.connection.connectionState !== 'closed') {
      peerData.connection.close()
    }

    this.peers.delete(peerId)
    console.log(`Peer connection closed: ${peerId}`)
  }

  // Close all connections
  closeAll() {
    this.peers.forEach((peerData, peerId) => {
      this.closePeer(peerId)
    })
    this.peers.clear()
    this.stopLocalStream()
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }
}

export default new MultiPeerManager()
