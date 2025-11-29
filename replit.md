# SmartMirror on Replit

## Overview
This is a **SmartMirror** application running on Replit - a web-based simulation of a smart mirror system built on MagicMirror². It provides face recognition simulation, voice command emulation, appointment scheduling, and budget tracking features without requiring Raspberry Pi hardware.

**Version:** 2.30.0 (MagicMirror² base)  
**Language:** Node.js (v20.19.3)  
**Last Updated:** November 29, 2025

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
  - "Mirror mirror, show budget" - Shows budget tracker
  - "Mirror mirror, what time is it" - Speaks the current time

### Appointment Scheduler
- View today's appointments
- Book new appointments with client name, service, and time
- Display barber assignments
- Real-time updates

### Budget Tracker
- Weekly and monthly goal tracking with progress bars
- Recent transaction history
- Add new earnings with service and client details
- Percentage progress display

## Project Architecture

### Key Directories
```
├── config/
│   └── config.js          - Main configuration (SmartMirror modules)
├── modules/
│   ├── default/           - Built-in MagicMirror modules
│   ├── MMM-Face-Recognition-SMAI/  - Face recognition module
│   ├── MMM-Appointments/  - Appointment scheduler module
│   └── MMM-Budget-Tracker/  - Budget tracking module
├── backend/
│   └── data.json          - Persistent storage for users, appointments, budget
├── js/                    - Core MagicMirror files
├── css/                   - Stylesheets
├── fonts/                 - Font files
└── translations/          - Language files
```

### Custom Modules

#### MMM-Face-Recognition-SMAI
- **Frontend:** `modules/MMM-Face-Recognition-SMAI/MMM-Face-Recognition-SMAI.js`
- **Backend:** `modules/MMM-Face-Recognition-SMAI/node_helper.js`
- **Styles:** `modules/MMM-Face-Recognition-SMAI/MMM-Face-Recognition-SMAI.css`

#### MMM-Appointments
- **Frontend:** `modules/MMM-Appointments/MMM-Appointments.js`
- **Backend:** `modules/MMM-Appointments/node_helper.js`
- **Styles:** `modules/MMM-Appointments/MMM-Appointments.css`

#### MMM-Budget-Tracker
- **Frontend:** `modules/MMM-Budget-Tracker/MMM-Budget-Tracker.js`
- **Backend:** `modules/MMM-Budget-Tracker/node_helper.js`
- **Styles:** `modules/MMM-Budget-Tracker/MMM-Budget-Tracker.css`

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
  port: 5000,            // Required for Replit webview
  ipWhitelist: [],       // Empty to allow Replit's proxy
}
```

### Module Positions
- **top_left:** Clock, Budget Tracker
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

This starts the MagicMirror server at `http://0.0.0.0:5000`

### Adding New Users
1. Click "Detect Face" or type "Mirror mirror, new face"
2. Enter the user's name when prompted
3. The system will "train" and add the new face

### Booking Appointments
1. Click "+ Book Appointment" in the Appointments module
2. Enter client name, service type, and time
3. Appointment appears in the list

### Adding Earnings
1. Click "+ Add Earning" in the Budget Tracker
2. Enter amount, service, and client name
3. Progress bars update automatically

### Available Scripts
- `npm run server` - Start server-only mode
- `npm run config:check` - Validate configuration file
- `npm test` - Run test suite

## Deployment
The project is configured for Replit deployment with:
- **Deployment Type:** Autoscale
- **Run Command:** `npm run server`

## Recent Changes
- **2025-11-29:** SmartMirror Enhancement
  - Added MMM-Face-Recognition-SMAI module with simulated face detection
  - Added MMM-Appointments module for scheduling
  - Added MMM-Budget-Tracker module for income tracking
  - Implemented voice command simulation with text input
  - Added Web Speech API for text-to-speech
  - Created node_helpers for server-side data management
  - Set up persistent JSON storage for all data

## Resources
- [MagicMirror² Documentation](https://docs.magicmirror.builders)
- [MagicMirror² Forum](https://forum.magicmirror.builders)
- [GitHub Repository](https://github.com/MagicMirrorOrg/MagicMirror)

## User Preferences
None set yet. User preferences will be documented here.

## Technical Notes
- Face recognition is simulated (no actual camera/OpenCV)
- Voice commands use text input (no actual microphone)
- TTS uses browser's Web Speech API (works in Chrome, Firefox, Safari)
- All data persists in JSON file between sessions
