# SmartMirror on Replit

## Overview
This is a **production-ready SmartMirror** application running on Replit - a web-based smart mirror system built on MagicMirror² with **real face recognition** (Azure Face API) and **real voice commands** (Web Speech API). It provides personalized greetings, voice-activated control, appointment scheduling, Telegram messaging relay, calendar integration, and budget tracking for barbers.

**Version:** 2.30.0 (MagicMirror² base)  
**Language:** Node.js (v20.19.3)  
**Last Updated:** November 30, 2025

## Production Features

### Real Face Recognition (Azure Face API)
- Uses Microsoft Azure Face API for actual face detection
- Detects face attributes (age, gender, emotions)
- Webcam access via browser's `getUserMedia()` API
- Falls back to simulation mode if camera unavailable

### Real Voice Commands (Web Speech API)
- Browser-based speech recognition (Chrome/Edge)
- "Mirror mirror..." wake phrase activation
- Continuous listening mode with visual feedback
- Text-to-speech responses

### Status Indicators
- 📷 **Camera Ready** - Webcam available
- 🎤 **Voice Ready** - Speech recognition supported
- ☁️ **Azure Connected** - Azure Face API configured

## Pages

### Mirror View (`/`)
Customer-facing smart mirror display with:
- Clock and date
- Real face recognition with camera
- Real voice commands with microphone
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

## Voice Commands

Say "Mirror mirror..." followed by:

| Command | Action |
|---------|--------|
| `detect face` | Triggers face recognition with camera |
| `who am i` | Identifies the person |
| `register` / `new face` | Trains a new user |
| `show messages` | Displays Telegram messages |
| `show appointments` | Shows today's schedule |
| `show calendar` | Displays upcoming events |
| `weather` | Shows weather info |
| `news` | Shows news headlines |
| `what time is it` | Speaks the current time |
| `what's the date` | Speaks today's date |
| `clear` | Returns to idle mode |
| `help` | Lists available commands |

## Telegram Bot Integration

### Bot: @BarberMirrorBot
The SmartMirror includes a fully integrated Telegram bot that acts as a mobile-friendly admin console.

### Features
1. **Interactive Menus** - Inline keyboard buttons for easy navigation
2. **Financial Tracking** - Record sales, view earnings, track weekly progress
3. **Appointment Management** - View today's appointments, send running late alerts
4. **Customer History** - View registered customers and visit counts
5. **Mirror Remote Control** - Trigger face detection, show appointments, clear display
6. **Message Relay** - Send text messages to display on the mirror

### Quick Actions
- Send a number (e.g., `45.50`) to record a sale
- Send any text message to display on the mirror
- Use `/start` for the main menu

### Message Flow
1. User sends message to @BarberMirrorBot
2. Python bot logs message to `backend/telegram_log.json`
3. MagicMirror module watches log file (every 2 seconds)
4. New messages displayed on mirror with TTS announcement
5. Commands (prefixed with `[COMMAND]`) trigger mirror actions

## Environment Variables

### Required Secrets
- `AZURE_FACE_API_KEY` - Your Azure Face API subscription key
- `TELEGRAM_BOT_TOKEN` - Telegram Bot API token from @BotFather

### Environment Variables
- `AZURE_FACE_ENDPOINT` - Azure Face API endpoint URL

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
│   ├── MMM-Face-Recognition-SMAI/  - Face recognition with Azure + voice
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
- **Purpose:** Real face detection (Azure) + real voice commands (Web Speech API)
- **Features:** Camera access, Azure Face API integration, speech recognition, TTS
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

## Browser Requirements

### For Voice Commands
- **Chrome** or **Edge** (required for Web Speech API)
- Microphone permission must be granted
- HTTPS connection (provided by Replit)

### For Camera/Face Recognition
- Webcam access must be granted
- Modern browser with `getUserMedia()` support

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
1. Click "Start Listening" or "Voice Command" button
2. Say "Mirror mirror, [command]" (e.g., "Mirror mirror, detect face")
3. The mirror will respond with text and TTS audio
4. Or type commands in the text input as fallback

### Testing Face Recognition
1. Click "Detect Face" button
2. Allow camera access when prompted
3. Look at the camera
4. Azure Face API will analyze and respond

## Deployment
The project is configured for Replit deployment with:
- **Deployment Type:** Autoscale
- **Run Command:** `node server.js`

## Recent Changes
- **2025-11-30:** Telegram Bot Stability Fix
  - Fixed bot conflict error when multiple instances tried to poll simultaneously
  - Added `drop_pending_updates=True` to clear stale sessions on startup
  - Updated start.sh to kill orphaned bot processes before restarting

- **2025-11-30:** Weather & Appointment System Fixes
  - Removed confusing sunset time display from weather module (showSun: false)
  - Replaced mock appointment data with real Telegram booking system
  - Fixed time slot handling with stable identifiers (slot_0900, slot_1000, etc.)
  - Added double-booking prevention for same date/time
  - Appointments include both `user` and `client` fields for compatibility
  - Time slots available: 9 AM - 5 PM in 1-hour increments

- **2025-11-30:** Face Detection Reliability Improvements
  - Added retry logic (5 attempts, 2-second intervals) for auto-light warm-up scenarios
  - Improved camera resource cleanup with proper video element teardown
  - Fixed "Register My Face" button to work without admin pre-registration
  - API preserves pending registration on duplicate name errors

- **2025-11-30:** Telegram Message Filtering
  - Bot commands (/start, /help, /today, /earnings) no longer displayed on mirror
  - Only barber-relevant messages shown: customer messages, late alerts, custom text
  - Commands filtered at both bot level (not logged) and display level (extra safety)

- **2025-11-30:** Responsive Admin Panel
  - Breakpoints at 1024px (tablet), 768px (mobile), 480px (small phone)
  - Scrollable tab navigation on mobile with hidden scrollbars
  - Touch-friendly buttons with 44px minimum height
  - Single-column stacking for cards and forms on small screens
  - Removed inline styles, created reusable CSS utility classes
  - Landscape and touch device optimizations

- **2025-11-30:** Module Configuration UI
  - Added "Modules" tab to admin panel for non-technical users
  - Toggle switches to enable/disable each module
  - Position dropdowns (top_left, bottom_right, etc.)
  - Module-specific settings (weather location, calendar URL, etc.)
  - Save & Apply generates new config.js automatically
  - Visual position guide showing mirror layout

- **2025-11-30:** Local Face Recognition with face-api.js
  - Integrated face-api.js for 100% local face recognition (no cloud waiting)
  - Face descriptors (128-point arrays) stored with customer profiles
  - Returning customers are recognized with "Welcome back!" + service history
  - Service logging: Barber records what service each customer received
  - Recommendations shown based on previous visits
  - Models loaded locally (~13MB): SSD MobileNet + landmarks + recognition

- **2025-11-30:** Face Registration System
  - Admin panel registration: Barber can enter customer name and trigger camera capture
  - Face image storage: Captures saved as files in backend/faces/ directory
  - Face descriptors stored for matching returning customers
  - Auto-prompt for unrecognized faces with friendly UI
  - Voice command "mirror mirror, register" for self-registration
  - Pending registration queue (admin initiates, mirror captures)

- **2025-11-29:** Production Face & Voice Recognition
  - Integrated Azure Face API for real face detection
  - Added Web Speech API for real voice commands
  - Camera access via getUserMedia()
  - Status indicators (Camera/Voice/Azure)
  - Visual feedback for listening state

- **2025-11-29:** Full SmartMirror Feature Implementation
  - Added MMM-TelegramRelayDisplay module for message relay
  - Added Calendar module with US Holidays
  - Enhanced admin panel with 3 tabs (Budget, Telegram, Controls)
  - Expanded voice commands (12+ commands)
  - Added mirror remote controls
  - Updated weather to Chicago location

## User Preferences
- Budget tracker should be admin/barber only (not on mirror)
- Mirror should display: clock, calendar, face recognition, weather, messages, appointments, news
- Real face and voice recognition for production use

## Technical Notes
- Face recognition uses Azure Face API (cloud-based)
- Voice commands use browser's Web Speech API
- TTS uses browser's Web Speech API
- All data persists in JSON file between sessions
- Server proxies MagicMirror from internal port 8080 to public port 5000
- Falls back to simulation mode if camera/microphone unavailable
