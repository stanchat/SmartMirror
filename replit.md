# SmartMirror on Replit

## Overview
This project is a **multi-tenant SaaS SmartMirror platform** designed for barbershops. It integrates a web-based smart mirror system, built on MagicMirror², with **real face recognition** (Azure Face API + face-api.js) and **real voice commands** (Web Speech API). Each barbershop tenant can manage multiple mirrors and barbers, supporting role-based access where Admins oversee the entire shop (barbers, services, mirrors, appointments, budget) and Barbers manage their own appointments and earnings. The platform aims to enhance the barbershop experience through interactive mirror displays and streamlined management tools.

## User Preferences
- Budget tracker should be admin/barber only (not on mirror)
- Mirror should display: clock, calendar, face recognition, weather, messages, appointments, news
- Real face and voice recognition for production use

## System Architecture
The SmartMirror platform is built using Node.js (v20.19.3) for the main application and Python 3.11 for the Telegram bot, with PostgreSQL as the database. It follows a multi-tenant architecture with JWT authentication.

### UI/UX Decisions
- **Mirror View (`/`)**: Customer-facing display with essential information like clock, date, calendar, weather, news, today's appointments, Telegram messages, and interactive face/voice recognition.
- **Admin Panel (`/admin`)**: A role-based management dashboard requiring authentication, offering distinct functionalities for Admin and Barber roles.
    - **Admin Role (7 tabs)**: Budget, Services, Telegram Bot, Mirror Controls, Modules, Team, Mirrors.
    - **Barber Role (5 tabs)**: Budget (personal earnings), Services (view only), Telegram, Mirror Controls, Modules.
- **Responsive Admin Panel**: Designed with breakpoints for tablet, mobile, and small phone, featuring scrollable tab navigation, touch-friendly buttons, and single-column stacking for forms on small screens.
- **Module Configuration UI**: A "Modules" tab in the admin panel allows non-technical users to enable/disable modules, set positions, and configure module-specific settings, with a visual position guide.

### Technical Implementations
- **Face Recognition**: Combines Microsoft Azure Face API for cloud-based detection of face attributes (age, gender, emotions) and local `face-api.js` for 100% local face recognition and descriptor storage. Includes a registration system via admin panel or voice command, and retries for reliability.
- **Voice Commands**: Leverages the browser's Web Speech API for speech recognition with a "Mirror mirror..." wake phrase and text-to-speech responses.
- **Telegram Bot Integration**: A Python-based Telegram bot (`@BarberMirrorBot`) acts as a mobile-friendly admin console, offering interactive menus for financial tracking, appointment management, customer history, mirror remote control, and message relay to the mirror.
- **Status Indicators**: Visual cues for Camera Ready, Voice Ready, and Azure Connected.
- **Core MagicMirror Modules**: Utilizes and customizes MagicMirror² modules for display functionalities.
- **Custom Modules**:
    - `MMM-Face-Recognition-SMAI`: Integrates Azure Face API and Web Speech API.
    - `MMM-TelegramRelayDisplay`: Displays messages from Telegram/admin.
    - `MMM-Appointments`: Shows and manages appointments.
- **Data Persistence**: All data is stored in PostgreSQL with multi-tenant isolation:
    - **Multi-tenant tables**: shops, barbers, mirror_devices, mirror_sessions, walk_in_queue
    - **Core tables (shop-scoped)**: users, services, appointments, transactions, messages, budget_targets, recognition_events
    - All tables include shop_id and/or barber_id foreign keys for data isolation
- **JWT Authentication**: Secure token-based auth with shop_id and role claims for API access control.
- **API Endpoints**: Comprehensive set of RESTful APIs for managing budget, appointments, services, users, Telegram messages, and mirror commands.

### System Design Choices
- **Multi-tenant architecture**: Supports multiple barbershops with isolated data.
- **Role-based access control**: Differentiates between Admin and Barber functionalities.
- **Client-side technologies**: Extensive use of browser APIs (getUserMedia, Web Speech API) for real-time interaction.
- **Hybrid Face Recognition**: Blends cloud-based Azure Face API with local `face-api.js` for robust and efficient recognition.
- **Modular Design**: MagicMirror² modules allow for flexible customization and extension.
- **Environment Variables**: Uses environment variables for sensitive API keys and configurable endpoints.

## External Dependencies
- **Microsoft Azure Face API**: For cloud-based face detection and attribute analysis.
- **Web Speech API**: Browser-based API for speech recognition and text-to-speech.
- **PostgreSQL (Neon-backed Replit DB)**: Primary database for all persistent data storage.
- **Telegram Bot API**: For integration with the `@BarberMirrorBot`.
- **`face-api.js`**: JavaScript API for local face detection and recognition.
- **Node.js `pg` (node-postgres)**: PostgreSQL client for Node.js.
- **Python `asyncpg`**: Asynchronous PostgreSQL client for Python.
- **MagicMirror²**: The foundational open-source smart mirror platform.
- **NY Times API**: For news feed display on the mirror.

## Future Enhancements

### Google Cloud TTS/STT Integration (Optional Upgrade)
The current implementation uses browser-native Web Speech API for voice recognition and text-to-speech. A previous version of this system used Google Cloud services which could be re-integrated for enhanced capabilities:

**Google Text-to-Speech (gTTS)**
- Higher quality, more natural-sounding voices
- Supports multiple languages and accents
- Generates MP3 files for audio playback
- Works with external speakers (Bluetooth, USB)
- Requires: `gTTS` Python package, audio player like `mpg123`

**Google Speech-to-Text (STT)**
- More accurate transcription than browser APIs
- Better handling of accents and background noise
- Works in headless/server environments
- Requires: `SpeechRecognition` Python package with Google credentials

**Implementation Considerations**
- Requires Google Cloud API credentials
- Incurs usage-based costs (free tier available)
- Better suited for Raspberry Pi deployments with external speakers
- Current Web Speech API is free and works well in browser environments

**When to Consider Google Cloud Voice**
- Deploying on Raspberry Pi with Bluetooth speakers
- Need higher quality voice output
- Require server-side voice processing
- Operating in noisy environments where accuracy is critical

**Current Implementation (Web Speech API)**
- Zero cost, no API keys needed
- Works directly in Chrome/Edge browsers
- Voice gender selection (male/female)
- Configurable rate, pitch, and volume
- Sufficient for most mirror display use cases