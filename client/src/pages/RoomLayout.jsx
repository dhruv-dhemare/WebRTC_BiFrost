import { useState, useRef } from 'react'
import { Menu, X, Copy, MessageSquare, FileUp, Video, ArrowLeft, Check, Upload, File, Download, Mic, Camera } from 'lucide-react'
import Logo from '../components/Logo'
import '../styles/room.css'

export default function RoomLayout({ roomCode, onLeaveRoom }) {
  const [activeTab, setActiveTab] = useState('chat')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleLeaveRoom = () => {
    if (onLeaveRoom) {
      onLeaveRoom()
    }
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
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'video' && <VideoView />}
        </div>
      </main>
    </div>
  )
}

function ChatView() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hey, I'm connected!", time: '12:01', sender: 'peer' },
    { id: 2, text: 'Got it, thanks! The connection is really fast.', time: '12:03', sender: 'peer' },
  ])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (input.trim()) {
      setMessages([...messages, {
        id: messages.length + 1,
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'you',
      }])
      setInput('')
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>Chat</h2>
        <p className="chat-subtitle">Real-time peer messaging</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-bubble">{msg.text}</div>
            <div className="message-time">{msg.time}</div>
          </div>
        ))}
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
  const [files, setFiles] = useState([
    { id: 1, name: 'design-spec.pdf', size: '2.4 MB', progress: 100, status: 'complete' },
    { id: 2, name: 'screenshot.png', size: '1.1 MB', progress: 67, status: 'uploading' },
    { id: 3, name: 'project.zip', size: '14.8 MB', progress: 34, status: 'uploading' },
  ])

  const handleDrop = (e) => {
    e.preventDefault()
    // Handle file drop
  }

  return (
    <div className="files-view">
      <div className="files-header">
        <h2>Files</h2>
        <p className="files-subtitle">Drag & drop to share</p>
      </div>

      <div className="drop-zone" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="drop-icon"><Upload size={32} /></div>
        <div className="drop-text">Drop files here</div>
        <div className="drop-subtext">or click to browse</div>
      </div>

      <div className="files-list">
        {files.map((file) => (
          <div key={file.id} className="file-item">
            <div className="file-icon"><File size={24} /></div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{file.size} · {file.status}</div>
              {file.progress < 100 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${file.progress}%` }}></div>
                </div>
              )}
            </div>
            <button className="file-action" aria-label={`Download ${file.name}`}>
              <Download size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoView() {
  return (
    <div className="video-view">
      <div className="video-header">
        <h2>Video Call</h2>
        <p className="video-subtitle">Peer-to-peer connection</p>
      </div>

      <div className="video-container">
        <div className="video-placeholder">
          <div className="video-icon"><Video size={48} /></div>
          <div className="video-status">Waiting for peer...</div>
          <div className="video-info">Video will appear here</div>
        </div>

        <div className="local-video">
          <div className="local-placeholder">You</div>
        </div>
      </div>

      <div className="video-controls">
        <button className="control-btn microphone" aria-label="Toggle microphone">
          <Mic size={20} />
        </button>
        <button className="control-btn camera" aria-label="Toggle camera">
          <Camera size={20} />
        </button>
        <button className="control-btn end-call" aria-label="End call">
          <X size={20} />
        </button>
      </div>
    </div>
  )
}
