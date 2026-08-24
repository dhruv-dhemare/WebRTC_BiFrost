# DigiCafe

DigiCafe is a real-time, multi-user WebRTC application that allows users to instantly create and join rooms for group video calls, real-time messaging, and high-speed peer-to-peer file sharing.

🌐 **Live Demo:** [Try DigiCafe](https://digicafe-frnds.vercel.app/)

## Features

- **Multi-Peer Video Conferencing**: Join rooms with up to 6 participants for seamless video calls.
- **Real-Time Group Chat**: Fast, reliable chat with native Emoji picker support. WhatsApp-style standalone large emojis!
- **P2P File Sharing**: Direct peer-to-peer drag-and-drop file sharing. Share files of any size without uploading to a centralized server.
- **Instant Rooms**: Generate instant shareable room codes and links. 
- **Modern Premium UI**: Sleek dark mode, custom gradients, responsive design, and smooth animations.

## Tech Stack

- **Frontend**: React.js, Vite, Vanilla CSS, Lucide Icons, emoji-picker-react.
- **Backend/Signaling Server**: Node.js, Express, Socket.io (Used purely for WebRTC signaling and establishing peer connections).
- **WebRTC**: Real-time media streams and data channels.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/dhruv-dhemare/DigiCafe
cd WEBRTC
```

2. Install Backend Dependencies
```bash
cd server
npm install
```

3. Install Frontend Dependencies
```bash
cd ../client
npm install
```

### Running the Application Locally

You will need to run both the signaling server and the client development server.

1. Start the Signaling Server
```bash
cd server
npm run dev
```

2. Start the React Client
```bash
cd client
npm run dev
```

The application will now be running on `http://localhost:5173`. 

## Usage

1. Open the app and click **Create Room**.
2. Enter your name and copy the instant join link or room code.
3. Share the link with your peers.
4. Peers joining the link will be prompted for their name and instantly added to your Mesh network!

## License

This project is licensed under the MIT License.
