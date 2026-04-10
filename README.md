# WebRTC File Sharing Application

Full-stack WebRTC file sharing application with React frontend and Node.js backend.

## Project Structure

```
webrtc/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.local
│   └── .gitignore
├── server/                 # Node.js + Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.js    # Configuration
│   │   │   └── database.js # Database connection
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── websocket/      # WebSocket setup
│   │   └── index.js        # Main server file
│   ├── setup.sql           # Database initialization
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
└── package.json            # Root package.json (workspaces)
```

## Quick Start

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Install all dependencies:**

```bash
npm run install-all
```

Or manually:

```bash
npm install
npm install --workspace=client
npm install --workspace=server
```

2. **Setup PostgreSQL database:**

```bash
psql -U postgres -f server/setup.sql
```

Or connect to PostgreSQL and run the SQL commands in `server/setup.sql`.

3. **Configure environment variables:**

Backend server `.env` is pre-configured for development. Modify if needed:

```
PORT=3000
JWT_SECRET=dev_secret_key_12345
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webrtc_app
NODE_ENV=development
```

Frontend `.env.local`:

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Development

**Option 1: Run both client and server together**

```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Frontend:

```bash
npm run dev:client
```

Terminal 2 - Backend:

```bash
npm run dev:server
```

### Build

```bash
npm run build:client
npm run build:server
```

### Start Production Server

```bash
npm run start:server
```

## Environment Variables

### Backend (.env)

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for JWT tokens
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)

### Frontend (.env.local)

- `VITE_API_URL` - Backend API URL
- `VITE_WS_URL` - WebSocket server URL

## Dependencies

### Frontend

- **react** - UI framework
- **vite** - Build tool and dev server
- **@vitejs/plugin-react** - React plugin for Vite

### Backend

- **express** - Web framework
- **ws** - WebSocket library
- **jsonwebtoken** - JWT token generation
- **pg** - PostgreSQL client
- **cors** - CORS middleware
- **dotenv** - Environment variable management
- **nodemon** - Development auto-restart (dev only)

## Database Schema

### rooms table

```sql
CREATE TABLE rooms (
  room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps

1. Implement WebRTC signaling logic
2. Add authentication service
3. Build file transfer logic
4. Create UI components
5. Setup error handling and logging
