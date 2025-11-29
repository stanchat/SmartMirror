# SmartMirror on Replit

## Overview
This is a **SmartMirror** application running on Replit - a web-based simulation of a smart mirror system built on MagicMirror². It provides face recognition simulation, voice command emulation, and appointment scheduling for customers, with a separate admin panel for barbers to manage their budget.

**Version:** 2.30.0 (MagicMirror² base)  
**Language:** Node.js (v20.19.3)  
**Last Updated:** November 29, 2025

## Pages

### Mirror View (`/`)
Customer-facing smart mirror display with:
- Clock and date
- Face recognition simulation
- Voice command input
- Weather (current + forecast)
- Today's appointments
- News feed

### Admin Panel (`/admin`)
Barber-only budget management page with:
- Weekly and monthly goal tracking
- Add earnings form
- Transaction history
- Edit goals functionality

## Features

### Face Recognition Simulation
- Simulated face detection with random recognition events
- Dynamic "Welcome, [Name]" messages with fade-in/out animations
- Face training for new users
- Recognition confidence display

### Voice Assistant Emulation
- Text input interface to simulate voice commands
- "Mirror mirror..." wake phrase activation
- Browser-based text-to-speech using Web Speech API
- Supported commands:
  - "Mirror mirror, detect face" - Triggers face recognition
  - "Mirror mirror, new face" - Trains a new user
  - "Mirror mirror, show appointments" - Displays today's schedule
  - "Mirror mirror, what time is it" - Speaks the current time

### Appointment Scheduler
- View today's appointments
- Book new appointments with client name, service, and time
- Display barber assignments
- Real-time updates

### Budget Tracker (Admin Only)
- Weekly and monthly goal tracking with progress bars
- Add earnings with amount, service, and client
- Transaction history
- Edit goals functionality

## Project Architecture

### Key Directories
```
├── config/
│   └── config.js          - Main MagicMirror configuration
├── admin/
│   ├── index.html         - Admin panel frontend
│   └── api.js             - Admin API routes
├── modules/
│   ├── default/           - Built-in MagicMirror modules
│   ├── MMM-Face-Recognition-SMAI/  - Face recognition module
│   └── MMM-Appointments/  - Appointment scheduler module
├── backend/
│   └── data.json          - Persistent storage for all data
├── server.js              - Main server (proxy + admin API)
├── js/                    - Core MagicMirror files
├── css/                   - Stylesheets
└── translations/          - Language files
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/budget` | GET | Get budget data and transactions |
| `/api/budget/transaction` | POST | Add a new earning |
| `/api/budget/goals` | POST | Update weekly/monthly goals |
| `/api/appointments` | GET | Get appointments list |
| `/api/appointments` | POST | Add new appointment |

### Data Storage
All data is persisted in `backend/data.json`:
- **users:** Registered faces with recognition count
- **appointments:** Scheduled appointments
- **budget:** Weekly/monthly goals and transactions
- **recognition_log:** History of face recognitions

## Configuration

### Replit-Specific Settings
```javascript
{
  address: "0.0.0.0",    // Required for Replit
  port: 8080,            // Internal MagicMirror port
  ipWhitelist: [],       // Empty to allow Replit's proxy
}
```

The main server runs on port 5000 and proxies to MagicMirror on port 8080.

### Module Positions
- **top_left:** Clock
- **top_right:** Weather (current + forecast)
- **middle_center:** Face Recognition (main interaction)
- **bottom_right:** Appointments
- **bottom_bar:** News feed

## Development

### Running the Server
The workflow "MagicMirror Server" runs:
```bash
bash start.sh
```

This starts the server at `http://0.0.0.0:5000`
- Mirror: `http://0.0.0.0:5000/`
- Admin: `http://0.0.0.0:5000/admin`

### Adding New Users
1. Click "Detect Face" or type "Mirror mirror, new face"
2. Enter the user's name when prompted
3. The system will "train" and add the new face

### Booking Appointments
1. Click "+ Book Appointment" in the Appointments module
2. Enter client name, service type, and time
3. Appointment appears in the list

### Adding Earnings (Admin Panel)
1. Go to `/admin`
2. Enter amount, service, and client name
3. Click "+ Add Earning"
4. Progress bars update automatically

### Available Scripts
- `npm run server` - Start MagicMirror only
- `npm run config:check` - Validate configuration file
- `npm test` - Run test suite

## Deployment
The project is configured for Replit deployment with:
- **Deployment Type:** Autoscale
- **Run Command:** `node server.js`

## Recent Changes
- **2025-11-29:** Separated Budget Tracker to Admin Panel
  - Removed budget tracker from mirror view
  - Created `/admin` page for barbers
  - Added API endpoints for budget management
  - Set up proxy server architecture

- **2025-11-29:** SmartMirror Enhancement
  - Added MMM-Face-Recognition-SMAI module with simulated face detection
  - Added MMM-Appointments module for scheduling
  - Implemented voice command simulation with text input
  - Added Web Speech API for text-to-speech
  - Created node_helpers for server-side data management
  - Set up persistent JSON storage for all data

## User Preferences
- Budget tracker should be admin/barber only (not on mirror)

## Technical Notes
- Face recognition is simulated (no actual camera/OpenCV)
- Voice commands use text input (no actual microphone)
- TTS uses browser's Web Speech API (works in Chrome, Firefox, Safari)
- All data persists in JSON file between sessions
- Server proxies MagicMirror from internal port 8080 to public port 5000
