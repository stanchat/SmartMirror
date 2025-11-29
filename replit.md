# SmartMirror on Replit

## Overview
This is a **SmartMirror** application running on Replit - a web-based simulation of a smart mirror system built on MagicMirror². It provides face recognition simulation, voice command emulation, appointment scheduling, Telegram messaging relay, calendar integration, and budget tracking for barbers.

**Version:** 2.30.0 (MagicMirror² base)  
**Language:** Node.js (v20.19.3)  
**Last Updated:** November 29, 2025

## Pages

### Mirror View (`/`)
Customer-facing smart mirror display with:
- Clock and date
- Face recognition simulation with voice commands
- Calendar with US holidays
- Weather (current + forecast) for Chicago
- Telegram message display
- Today's appointments
- News feed (NY Times)

### Admin Panel (`/admin`)
Barber-only management page with three tabs:
1. **Budget Tab:** Weekly/monthly goal tracking, add earnings, transaction history
2. **Telegram Bot Tab:** Send messages to mirror, quick bot commands, message history
3. **Mirror Controls Tab:** Remote control for face detection, greetings, show messages

## Features

### 1. Face Recognition Simulation
- Simulated face detection with random recognition events
- Dynamic "Welcome, [Name]" messages with animations
- Face training for new users
- Recognition confidence display
- Personalized TTS greeting via Web Speech API

### 2. Voice Assistant Emulation
- Text input interface to simulate voice commands
- "Mirror mirror..." wake phrase activation
- Browser-based text-to-speech (Web Speech API)
- Supported commands:
  - `Mirror mirror, detect face` - Triggers face recognition
  - `Mirror mirror, new face` - Trains a new user
  - `Mirror mirror, show messages` - Displays Telegram messages
  - `Mirror mirror, show appointments` - Shows today's schedule
  - `Mirror mirror, show calendar` - Displays upcoming events
  - `Mirror mirror, weather` - Shows weather info
  - `Mirror mirror, news` - Shows news headlines
  - `Mirror mirror, what time is it` - Speaks the current time
  - `Mirror mirror, what's the date` - Speaks today's date
  - `Mirror mirror, help` - Lists available commands

### 3. Telegram Relay Display
- Real-time message display on mirror
- Messages sent from admin panel appear on mirror
- TTS announcement of new messages
- Message history with sender and timestamp

### 4. Calendar Integration
- US Holidays via iCal feed
- Upcoming events display

### 5. Appointment Scheduler
- View today's appointments
- Book new appointments with client name, service, and time
- Display barber assignments
- Real-time updates

### 6. Budget Tracker (Admin Only)
- Weekly and monthly goal tracking with progress bars
- Add earnings with amount, service, and client
- Transaction history
- Edit goals functionality

### 7. Weather Module
- Current weather for Chicago
- 5-day forecast
- Uses Open-Meteo API (no API key required)

### 8. News Feed
- NY Times RSS feed
- Auto-rotating headlines

## Project Architecture

### Key Directories
```
├── config/
│   └── config.js          - Main MagicMirror configuration
├── admin/
│   ├── index.html         - Admin panel frontend (3 tabs)
│   └── api.js             - Admin API routes
├── modules/
│   ├── default/           - Built-in MagicMirror modules
│   ├── MMM-Face-Recognition-SMAI/  - Face recognition module
│   ├── MMM-TelegramRelayDisplay/   - Telegram message display
│   └── MMM-Appointments/  - Appointment scheduler module
├── backend/
│   └── data.json          - Persistent storage for all data
├── server.js              - Main server (proxy + admin API)
├── js/                    - Core MagicMirror files
├── css/                   - Stylesheets
└── translations/          - Language files
```

### Custom Modules

#### MMM-Face-Recognition-SMAI
- **Purpose:** Face detection simulation + voice commands
- **Files:** `MMM-Face-Recognition-SMAI.js`, `node_helper.js`, CSS

#### MMM-TelegramRelayDisplay
- **Purpose:** Display messages sent from Telegram/admin
- **Files:** `MMM-TelegramRelayDisplay.js`, `node_helper.js`, CSS

#### MMM-Appointments
- **Purpose:** Show and manage appointments
- **Files:** `MMM-Appointments.js`, `node_helper.js`, CSS

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/budget` | GET | Get budget data and transactions |
| `/api/budget/transaction` | POST | Add a new earning |
| `/api/budget/goals` | POST | Update weekly/monthly goals |
| `/api/appointments` | GET | Get appointments list |
| `/api/appointments` | POST | Add new appointment |
| `/api/telegram/messages` | GET | Get message history |
| `/api/telegram/send` | POST | Send message to mirror |
| `/api/mirror/command` | POST | Send command to mirror |

### Data Storage
All data is persisted in `backend/data.json`:
- **users:** Registered faces with recognition count
- **appointments:** Scheduled appointments
- **budget:** Weekly/monthly goals and transactions
- **telegram_messages:** Message history
- **recognition_log:** History of face recognitions

## Configuration

### Module Positions
- **top_left:** Clock, Calendar (US Holidays)
- **top_right:** Weather (current + forecast)
- **middle_center:** Face Recognition (main interaction)
- **bottom_left:** Telegram Messages
- **bottom_right:** Appointments
- **bottom_bar:** News feed

### Replit Settings
```javascript
{
  address: "0.0.0.0",    // Required for Replit
  port: 8080,            // Internal MagicMirror port
  ipWhitelist: [],       // Empty to allow Replit's proxy
}
```
Main server runs on port 5000 and proxies to MagicMirror on port 8080.

## Development

### Running the Server
The workflow "MagicMirror Server" runs:
```bash
bash start.sh
```

This starts the server at `http://0.0.0.0:5000`
- Mirror: `http://0.0.0.0:5000/`
- Admin: `http://0.0.0.0:5000/admin`

### Testing Voice Commands
1. Type a command in the voice input field (e.g., "Mirror mirror, detect face")
2. Click Send or press Enter
3. The mirror will respond with text and TTS audio

### Sending Messages to Mirror
1. Go to `/admin` and click "Telegram Bot" tab
2. Enter sender name and message
3. Click "Send to Mirror"
4. Message appears on the mirror display

### Adding Earnings (Admin Panel)
1. Go to `/admin` (Budget tab)
2. Enter amount, service, and client name
3. Click "+ Add Earning"
4. Progress bars update automatically

## Deployment
The project is configured for Replit deployment with:
- **Deployment Type:** Autoscale
- **Run Command:** `node server.js`

## Recent Changes
- **2025-11-29:** Full SmartMirror Feature Implementation
  - Added MMM-TelegramRelayDisplay module for message relay
  - Added Calendar module with US Holidays
  - Enhanced admin panel with 3 tabs (Budget, Telegram, Controls)
  - Expanded voice commands (12+ commands)
  - Added mirror remote controls
  - Updated weather to Chicago location

- **2025-11-29:** Separated Budget Tracker to Admin Panel
  - Removed budget tracker from mirror view
  - Created `/admin` page for barbers

## User Preferences
- Budget tracker should be admin/barber only (not on mirror)
- Mirror should display: clock, calendar, face recognition, weather, messages, appointments, news

## Technical Notes
- Face recognition is simulated (no actual camera/OpenCV)
- Voice commands use text input (no actual microphone)
- TTS uses browser's Web Speech API
- All data persists in JSON file between sessions
- Server proxies MagicMirror from internal port 8080 to public port 5000
