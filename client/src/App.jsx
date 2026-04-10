import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import RoomLayout from './pages/RoomLayout'

export default function App() {
  const [currentPage, setCurrentPage] = useState('landing')
  const [roomCode, setRoomCode] = useState(null)

  const handleCreateRoom = () => {
    // Generate room code
    const code = Math.random().toString(36).substr(2, 6).toUpperCase()
    setRoomCode(code)
    setCurrentPage('room')
  }

  const handleJoinRoom = (code) => {
    setRoomCode(code)
    setCurrentPage('room')
  }

  const handleLeaveRoom = () => {
    setRoomCode(null)
    setCurrentPage('landing')
  }

  if (currentPage === 'landing') {
    return <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
  }

  if (currentPage === 'room') {
    return <RoomLayout roomCode={roomCode} onLeaveRoom={handleLeaveRoom} />
  }

  return <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
}
