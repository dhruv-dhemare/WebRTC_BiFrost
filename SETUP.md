# Setup Quick Reference

## Folder Structure

```
WEBRTC/
│
├── client/                          # React + Vite Frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── pages/                   # Page components
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── utils/                   # Utility functions
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/                      # Static assets
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.local                   # Environment variables
│   ├── .env.example
│   └── .gitignore
│
├── server/                          # Node.js + Express Backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.js             # Config loader
│   │   │   └── database.js          # DB connection pool
│   │   ├── routes/
│   │   │   └── index.js             # API routes
│   │   ├── services/                # Business logic (empty)
│   │   ├── websocket/
│   │   │   └── index.js             # WebSocket setup
│   │   └── index.js                 # Main Express server
│   ├── setup.sql                    # PostgreSQL init script
│   ├── package.json
│   ├── .env                         # Environment variables
│   ├── .env.example                 # Template
│   └── .gitignore
│
├── package.json                     # Root workspaces config
└── README.md
```

## Step-by-Step Installation

### Step 1: Install Dependencies

**Option A - Using Workspace Command (Recommended)**

```bash
npm run install-all
```

**Option B - Manual Installation**

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..
```

### Step 2: Setup PostgreSQL Database

**Create database and table:**

```bash
# Using psql directly
psql -U postgres -f server/setup.sql

# Or connect to PostgreSQL and run SQL commands from server/setup.sql
```

**Expected output:**
```
CREATE DATABASE
You are now connected to database "webrtc_app"
CREATE TABLE
CREATE INDEX
CREATE EXTENSION
```

### Step 3: Verify Environment Variables

**Frontend** (`client/.env.local`):
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

**Backend** (`server/.env`):
```
PORT=3000
JWT_SECRET=dev_secret_key_12345
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webrtc_app
NODE_ENV=development
```

### Step 4: Start Development Servers

**Option A - Launch Both Together**

```bash
npm run dev
```

**Option B - Launch Separately**

Terminal 1 (Frontend):
```bash
npm run dev:client
```

Terminal 2 (Backend):
```bash
npm run dev:server
```

**Expected outputs:**

Frontend:
```
VITE v4.3.9 running at:
  > Local:     http://localhost:5173/
```

Backend:
```
Server running on http://localhost:3000
WebSocket server ready on ws://localhost:3000
```

## Configuration Files Explained

### Frontend Vite Config (`client/vite.config.js`)

```javascript
- port: 5173 (dev server port)
- api proxy: /api requests forward to http://localhost:3000
```

### Backend Express Config (`server/src/config/index.js`)

Loads from .env:
- PORT (default: 3000)
- JWT_SECRET (required)
- DATABASE_URL (required)
- NODE_ENV (default: development)

### Database Config (`server/src/config/database.js`)

- Connection pooling using pg.Pool
- Auto-reconnect on disconnection
- Used by database queries

### WebSocket Setup (`server/src/websocket/index.js`)

- WebSocket server attached to HTTP server
- Connection/disconnection event handlers
- Ready for signaling logic implementation

## npm Scripts Reference

### Root Scripts

```bash
npm run dev              # Run client and server together
npm run dev:client       # Run frontend only
npm run dev:server       # Run backend only
npm run build:client     # Build frontend for production
npm run start:server     # Start production server
npm run install-all      # Install all dependencies
```

### Client Scripts (in client/ directory)

```bash
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build
```

### Server Scripts (in server/ directory)

```bash
npm run start            # Start with node
npm run dev              # Start with nodemon (auto-reload on changes)
```

## Troubleshooting

### Port Already in Use

If port 3000 or 5173 is busy:

1. **Frontend:** Vite will auto-increment port (5174, 5175, etc.)
2. **Backend:** Change `PORT` in `server/.env`

### Database Connection Error

Check PostgreSQL is running:

```bash
# For Windows
Get-Service PostgreSQL*

# For macOS
brew services list | grep postgres

# For Linux
sudo service postgresql status
```

Verify connection string in `server/.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webrtc_app
```

### Dependencies Not Installing

Clear npm cache:

```bash
npm cache clean --force
rm -rf node_modules
npm install
```

## Next Development Steps

1. **WebRTC Integration** - Add peer connection logic
2. **Signaling** - Implement via WebSocket in `src/websocket/`
3. **File Transfer** - Add file chunking/compression in `src/services/`
4. **UI Components** - Build React components in `client/src/components/`
5. **Error Handling** - Add try-catch and logging

## Production Deployment

### Frontend Build

```bash
npm run build:client
# Output: client/dist/
```

Deploy `client/dist/` to static hosting (Vercel, Netlify, S3, etc.)

### Backend Deployment

```bash
# Build
npm run build:server

# Start
npm run start:server

# Environment variables needed in production:
# PORT=3000 (or your hosting provider's port)
# JWT_SECRET=your_strong_secret_here
# DATABASE_URL=production_postgres_url
# NODE_ENV=production
```
