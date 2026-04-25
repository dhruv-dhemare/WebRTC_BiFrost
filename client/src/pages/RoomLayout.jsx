import { useState, useRef, useEffect } from 'react'
import { Menu, X, Copy, MessageSquare, FileUp, Video, ArrowLeft, Check, Upload, File, Download, Mic, Camera, Users } from 'lucide-react'
import Logo from '../components/Logo'
import '../styles/room.css'
import ws from '../services/websocket'
import multiPeerManager from '../services/multiPeerManager'

export default function RoomLayout({ roomCode, isCreator, userName, setRoomCode, onLeaveRoom }) {
  const [activeTab, setActiveTab] = useState('chat')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remotePeers, setRemotePeers] = useState(new Map()) // peerId -> { stream, userName }
  const [connectedPeers, setConnectedPeers] = useState(new Map()) // peerId -> { userName, connected: true }
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [roomUsers, setRoomUsers] = useState([]) // All users in the room
  const [myClientId, setMyClientId] = useState(null)
  
  // Track if we've already sent the create/join message
  const hasInitialized = useRef(false)
  const joinRetryCount = useRef(0)
  const joinRetryTimeoutRef = useRef(null)
  const maxRetries = 3

  // Connect to WebSocket on mount
  useEffect(() => {
    const initWebSocket = async () => {
      try {
        setConnectionStatus('Connecting...')
        await ws.connect()
        
        // Create room if we're the creator, otherwise join (only once)
        if (!hasInitialized.current) {
          hasInitialized.current = true
          
          if (isCreator) {
            console.log('🏠 Creating room...')
            ws.send('create', { userName })
          } else if (roomCode) {
            console.log('👥 Joining room:', roomCode)
            ws.send('join', { roomId: roomCode, userName })
          }
        }
        
        // Update status when connected
        ws.on('connected', () => {
          setConnectionStatus('Connected to server')
        })
        
        // Handle server errors (join/create failures)
        ws.on('error', (data) => {
          console.error('❌ Server error:', JSON.stringify(data, null, 2))
          const errorMsg = data?.message || 'Server error'
          const roomId = data?.roomId || roomCode
          const availableRooms = data?.available_rooms || 'NONE'
          
          setConnectionStatus(`❌ ${errorMsg}`)
          
          console.log(`🔍 Debugging Info:`)
          console.log(`   Room attempted: ${roomId}`)
          console.log(`   Available rooms: ${availableRooms}`)
          console.log(`   Raw error data:`, data)
          
          if (availableRooms && availableRooms !== 'NONE') {
            console.log('✅ Rooms available:', availableRooms)
          } else {
            console.log('⚠️ No rooms on server. The room may have expired or server restarted.')
            
            // Auto-retry if join failed and we haven't exceeded max retries
            if (!isCreator && joinRetryCount.current < maxRetries) {
              const retryDelay = 2000 * (joinRetryCount.current + 1) // Exponential backoff: 2s, 4s, 6s
              joinRetryCount.current++
              
              console.log(`🔄 Retrying join in ${retryDelay / 1000}s (Attempt ${joinRetryCount.current}/${maxRetries})`)
              setConnectionStatus(`⏳ Retrying... (${joinRetryCount.current}/${maxRetries})`)
              
              joinRetryTimeoutRef.current = setTimeout(() => {
                console.log(`🔄 Retrying join for room: ${roomCode}`)
                ws.send('join', { roomId: roomCode, userName })
              }, retryDelay)
            } else if (!isCreator && joinRetryCount.current >= maxRetries) {
              console.log('❌ Max join retries exceeded')
              setConnectionStatus('❌ Room connection failed. Please create a new room.')
            } else {
              console.log('💡 Solution: Try creating a new room and joining immediately')
            }
          }
        })
        
        // Handle room creation
        ws.on('room_created', (data) => {
          console.log('🏠 Room created:', data.roomId, 'Client ID:', data.clientId)
          
          // Reset retry count on successful room creation
          joinRetryCount.current = 0
          if (joinRetryTimeoutRef.current) {
            clearTimeout(joinRetryTimeoutRef.current)
          }
          
          setRoomCode(data.roomId)
          setMyClientId(data.clientId)
          setRoomUsers(data.users || [])
          setConnectionStatus('Room created, waiting for others...')
        })
        
        // Handle join confirmation
        ws.on('join_confirmed', (data) => {
          console.log('✓ Joined room:', data.roomId, 'Client ID:', data.clientId)
          
          // Reset retry count on successful join
          joinRetryCount.current = 0
          if (joinRetryTimeoutRef.current) {
            clearTimeout(joinRetryTimeoutRef.current)
          }
          
          setRoomCode(data.roomId)
          setMyClientId(data.clientId)
          setRoomUsers(data.users || [])
          setConnectionStatus('Joined room')
          
          // Initialize peer connections with existing users
          const otherUsers = data.users.filter(u => u.clientId !== data.clientId)
          otherUsers.forEach(user => {
            console.log(`👥 Initializing peer connection as responder for ${user.name}`)
            multiPeerManager.initializePeerConnection(user.clientId, false, user.name)
          })
        })
        
        // When a new user joins
        ws.on('user_joined', (data) => {
          console.log('👥 New user joined:', data.newUser.name)
          setRoomUsers(data.users || [])
          setConnectionStatus(`${data.newUser.name} joined the room`)
          
          // Initialize as initiator for the new user
          if (myClientId && data.newUser.clientId !== myClientId) {
            console.log(`👥 Initializing peer connection as initiator for ${data.newUser.name}`)
            multiPeerManager.initializePeerConnection(data.newUser.clientId, true, data.newUser.name)
          }
        })
        
        // When a user leaves
        ws.on('user_left', (data) => {
          console.log('👋 User left:', data.leftUserName)
          setRoomUsers(data.users || [])
          setConnectionStatus(`${data.leftUserName} left the room`)
          
          // Close peer connection
          multiPeerManager.closePeer(data.leftUserId)
          
          // Update remote peers
          setRemotePeers(prev => {
            const updated = new Map(prev)
            updated.delete(data.leftUserId)
            return updated
          })
        })
        
        // Handle incoming offer
        ws.on('offer', (data) => {
          console.log('📤 Received offer from', data.fromName)
          multiPeerManager.handleOffer(data.fromId, data.sdp, data.fromName)
        })
        
        // Handle incoming answer
        ws.on('answer', (data) => {
          console.log('📥 Received answer from', data.fromName)
          multiPeerManager.handleAnswer(data.fromId, data.sdp)
        })
        
        // Handle incoming ICE candidate
        ws.on('ice_candidate', (data) => {
          console.log('❄️ Received ICE candidate from', data.fromId)
          multiPeerManager.handleIceCandidate(
            data.fromId,
            data.candidate,
            data.sdpMLineIndex,
            data.sdpMid,
            data.usernameFragment
          )
        })
        
        // Handle peer connection state changes
        multiPeerManager.on('peer_initialized', (data) => {
          console.log(`🔌 Peer initialized: ${data.userName} (${data.isInitiator ? 'initiator' : 'responder'})`)
          // Track peer immediately (before fully connected)
          setConnectedPeers(prev => new Map(prev).set(data.peerId, {
            userName: data.userName,
            connected: false
          }))
        })
        
        multiPeerManager.on('peer_connected', (data) => {
          console.log(`✓ Connected to ${data.userName}`)
          setConnectionStatus(`Connected to ${data.userName}`)
          // Update peer status to connected
          setConnectedPeers(prev => new Map(prev).set(data.peerId, {
            userName: data.userName,
            connected: true
          }))
        })
        
        multiPeerManager.on('peer_disconnected', (data) => {
          console.log(`✗ Disconnected from ${data.userName}`)
          // Remove from both video peers and connected peers
          setRemotePeers(prev => {
            const updated = new Map(prev)
            updated.delete(data.peerId)
            return updated
          })
          setConnectedPeers(prev => {
            const updated = new Map(prev)
            updated.delete(data.peerId)
            return updated
          })
        })

        // Handle remote stream
        multiPeerManager.on('remote_stream', (data) => {
          console.log(`🎥 Remote stream received from ${data.userName}`)
          setRemotePeers(prev => new Map(prev).set(data.peerId, {
            stream: data.stream,
            userName: data.userName
          }))
        })

        // Handle connection_state_change
        multiPeerManager.on('connection_state_change', (data) => {
          console.log(`Connection state for ${data.peerId}: ${data.state}`)
        })
        
        // Handle disconnection
        ws.on('disconnected', () => {
          setConnectionStatus('Disconnected')
          multiPeerManager.closeAll()
        })
        
        // Handle errors
        ws.on('error', (error) => {
          console.error('WebSocket error:', error)
          setConnectionStatus('Connection error')
        })
        
        ws.on('reconnect_failed', () => {
          setConnectionStatus('Connection failed')
        })
      } catch (error) {
        console.error('Failed to initialize:', error)
        setConnectionStatus('Connection failed')
      }
    }

    initWebSocket()

    // Cleanup on unmount
    return () => {
      // Clear any pending join retries
      if (joinRetryTimeoutRef.current) {
        clearTimeout(joinRetryTimeoutRef.current)
      }
      
      multiPeerManager.closeAll()
      if (ws.isConnected()) {
        ws.disconnect()
      }
    }
  }, [isCreator, roomCode, userName])

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleLeaveRoom = () => {
    multiPeerManager.closeAll()
    if (onLeaveRoom) {
      onLeaveRoom()
    }
  }

  // Start local media stream
  const startLocalMedia = async () => {
    try {
      const constraints = {
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      }
      const stream = await multiPeerManager.getUserMedia(constraints)
      setLocalStream(stream)
      setIsAudioEnabled(true)
      setIsVideoEnabled(true)
    } catch (error) {
      console.error('Failed to get user media:', error)
      alert('Failed to access camera/microphone. Please check permissions.')
    }
  }

  // Stop local media stream
  const stopLocalMedia = () => {
    if (localStream) {
      multiPeerManager.stopLocalStream()
      setLocalStream(null)
      setIsAudioEnabled(false)
      setIsVideoEnabled(false)
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  // Send message to all peers
  const sendMessage = (message) => {
    // Use connectedPeers for messaging (includes peers without video)
    const peers = Array.from(connectedPeers.keys())
    console.log(`📤 Sending message to ${peers.length} connected peers:`, Array.from(connectedPeers.values()).map(p => p.userName))
    let sent = false
    
    if (peers.length === 0) {
      console.warn('⚠️ No connected peers to send message to')
      return false
    }
    
    peers.forEach(peerId => {
      if (multiPeerManager.sendMessage(peerId, 'chat', { type: 'text', text: message })) {
        console.log(`✓ Message sent to peer ${peerId}`)
        sent = true
      }
    })
    
    return sent
  }

  return (
    <div className="room-container">
      {/* Mobile Sidebar Toggle */}
      <button 
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      <aside className={`room-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        {/* Logo Section */}
        <div className="sidebar-header">
          <Logo variant="small" />
          <button 
            className="close-sidebar"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Room Info */}
        <div className="room-info">
          <div className="room-label">ROOM</div>
          <div className="room-code-display">
            <span className="room-code">{roomCode}</span>
            <button 
              className={`copy-btn ${isCopied ? 'copied' : ''}`}
              onClick={handleCopyRoomCode}
              aria-label="Copy room code"
              title="Copy room code"
            >
              {isCopied ? <Check size={20} style={{ color: 'green' }} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="user-list-section">
          <div className="user-list-header">
            <Users size={18} />
            <span className="user-count">{roomUsers.length}/6</span>
          </div>
          <div className="user-list">
            {roomUsers.map(user => (
              <div key={user.clientId} className={`user-item ${user.clientId === myClientId ? 'me' : ''}`}>
                <div className="user-avatar" style={{
                  background: `hsl(${user.clientId.charCodeAt(0) * 10}, 70%, 50%)`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-name">
                  {user.name}
                  {user.clientId === myClientId && <span className="me-badge">(You)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connection Status */}
        <div className="connection-status">
          <span className="status-dot"></span>
          <span className="status-text">{connectionStatus}</span>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('chat')
              setIsSidebarOpen(false)
            }}
            aria-label="Chat tab"
          >
            <span className="tab-icon"><MessageSquare size={20} /></span>
            <span className="tab-label">Chat</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('files')
              setIsSidebarOpen(false)
            }}
            aria-label="Files tab"
          >
            <span className="tab-icon"><FileUp size={20} /></span>
            <span className="tab-label">Files</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('video')
              setIsSidebarOpen(false)
            }}
            aria-label="Video tab"
          >
            <span className="tab-icon"><Video size={20} /></span>
            <span className="tab-label">Video</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button className="leave-btn" onClick={handleLeaveRoom} aria-label="Leave room">
            <ArrowLeft size={20} /> Leave
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="room-main">
        <div className="room-content">
          {activeTab === 'chat' && <ChatView onSendMessage={sendMessage} userName={userName} connectedPeers={connectedPeers} />}
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'video' && (
            <VideoView 
              localStream={localStream}
              remotePeers={remotePeers}
              isVideoEnabled={isVideoEnabled}
              isAudioEnabled={isAudioEnabled}
              userName={userName}
              onStartMedia={startLocalMedia}
              onStopMedia={stopLocalMedia}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function ChatView({ onSendMessage, userName, connectedPeers }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  // Listen for incoming messages
  useEffect(() => {
    const handleMessage = (data) => {
      console.log('📥 ChatView received message:', data)
      const text = data.text || data
      const peerId = data.peerId || 'unknown'
      
      // Look up peer name from connectedPeers
      const peerName = connectedPeers?.get(peerId)?.userName || 'Unknown User'
      
      const newMessage = {
        id: Date.now(),
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'peer',
        peerId: peerId,
        peerName: peerName
      }
      
      console.log(`✓ Message from ${peerName}: ${text}`)
      setMessages(prev => [...prev, newMessage])
    }

    // Listen for text messages from peers
    multiPeerManager.on('text_message', handleMessage)

    return () => {
      multiPeerManager.off('text_message', handleMessage)
    }
  }, [connectedPeers])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (input.trim()) {
      // Add message to local UI
      const newMessage = {
        id: Date.now(),
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'you',
        senderName: userName
      }
      setMessages(prev => [...prev, newMessage])
      
      // Send through data channels
      if (onSendMessage) {
        onSendMessage(input)
      } else {
        // Fallback to WebSocket if data channels not available
        ws.send('chat_message', { text: input })
      }
      setInput('')
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>Group Chat</h2>
        <p className="chat-subtitle">Real-time messaging</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              {msg.sender === 'peer' && (
                <div className="message-sender">{msg.peerName || 'Peer'}</div>
              )}
              <div className="message-bubble">{msg.text}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message input"
        />
        <button type="submit" className="send-btn" aria-label="Send message">
          <Check size={20} />
        </button>
      </form>
    </div>
  )
}

function FilesView() {
  const [sendingFiles, setSendingFiles] = useState({})
  const [receivedFiles, setReceivedFiles] = useState([])
  const fileInputRef = useRef(null)

  // Listen for file transfer events
  useEffect(() => {
    const handleFileSendProgress = (data) => {
      setSendingFiles(prev => ({
        ...prev,
        [data.fileId]: {
          name: data.fileName,
          progress: Math.round(data.progress),
          status: 'uploading',
          peerId: data.peerId
        }
      }))
    }

    const handleFileSent = (data) => {
      setSendingFiles(prev => ({
        ...prev,
        [data.fileId]: {
          ...prev[data.fileId],
          status: 'complete',
          progress: 100
        }
      }))
    }

    multiPeerManager.on('file_send_progress', handleFileSendProgress)
    multiPeerManager.on('file_sent', handleFileSent)

    return () => {
      multiPeerManager.off('file_send_progress', handleFileSendProgress)
      multiPeerManager.off('file_sent', handleFileSent)
    }
  }, [])

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return

    for (let file of files) {
      try {
        await multiPeerManager.sendFile(file)
      } catch (error) {
        console.error('Error sending file:', error)
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleFileSelect(e.dataTransfer.files)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const allFiles = Object.entries(sendingFiles).map(([fileId, data]) => ({
    id: fileId,
    ...data,
    type: 'sending'
  }))

  return (
    <div className="files-view">
      <div className="files-header">
        <h2>Files</h2>
        <p className="files-subtitle">Share with group</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-label="Select files"
      />

      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={handleBrowseClick}
      >
        <div className="drop-icon"><Upload size={32} /></div>
        <div className="drop-text">Drop files here</div>
        <div className="drop-subtext">or click to browse</div>
      </div>

      <div className="files-list">
        {allFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
            No files yet
          </div>
        ) : (
          allFiles.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-icon"><File size={24} /></div>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-sender">
                  {file.type === 'sending' ? 'Sending...' : `from ${file.senderName || 'Unknown'}`}
                </div>
                <div className="file-size">
                  {file.progress}% · {file.status}
                </div>
                {file.progress < 100 && (
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function VideoView({
  localStream,
  remotePeers,
  isVideoEnabled,
  isAudioEnabled,
  userName,
  onStartMedia,
  onStopMedia,
  onToggleAudio,
  onToggleVideo
}) {
  const localVideoRef = useRef(null)
  const remoteVideoRefs = useRef(new Map())

  // Update video elements when streams change
  useEffect(() => {
    remotePeers.forEach((peerData, peerId) => {
      const ref = remoteVideoRefs.current.get(peerId)
      if (ref && peerData.stream) {
        ref.srcObject = peerData.stream
      }
    })
  }, [remotePeers])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  const setRemoteVideoRef = (peerId, ref) => {
    if (ref) {
      remoteVideoRefs.current.set(peerId, ref)
    } else {
      remoteVideoRefs.current.delete(peerId)
    }
  }

  return (
    <div className="video-view">
      <div className="video-header">
        <h2>Video Call</h2>
        <p className="video-subtitle">Group video conference</p>
        {localStream && <p style={{ fontSize: '0.875rem', color: '#888' }}>📹 Camera: {isVideoEnabled ? 'ON' : 'OFF'} | 🎤 Mic: {isAudioEnabled ? 'ON' : 'OFF'}</p>}
      </div>

      <div className="video-grid">
        {/* Local Video */}
        {localStream ? (
          <div className="video-tile local">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div className="video-label">{userName} (You)</div>
          </div>
        ) : null}

        {/* Remote Videos */}
        {Array.from(remotePeers.entries()).map(([peerId, peerData]) => (
          <div key={peerId} className="video-tile remote">
            <video
              ref={(ref) => setRemoteVideoRef(peerId, ref)}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
            />
            <div className="video-label">{peerData.userName}</div>
          </div>
        ))}

        {/* Placeholder for empty slots */}
        {!localStream && remotePeers.size === 0 && (
          <div className="video-placeholder-grid">
            <div className="video-icon"><Video size={48} /></div>
            <div className="video-status">Start video to begin</div>
            <div className="video-info">Waiting for participants...</div>
          </div>
        )}
      </div>

      <div className="video-controls">
        {!localStream ? (
          <button className="control-btn start-call" onClick={onStartMedia} aria-label="Start video">
            <Video size={20} /> Start
          </button>
        ) : (
          <>
            <button
              className={`control-btn ${isAudioEnabled ? 'microphone' : 'microphone-off'}`}
              onClick={onToggleAudio}
              aria-label="Toggle microphone"
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              <Mic size={20} />
            </button>
            <button
              className={`control-btn ${isVideoEnabled ? 'camera' : 'camera-off'}`}
              onClick={onToggleVideo}
              aria-label="Toggle camera"
              title={isVideoEnabled ? 'Stop video' : 'Start video'}
            >
              <Camera size={20} />
            </button>
            <button className="control-btn end-call" onClick={onStopMedia} aria-label="Stop call">
              <X size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
