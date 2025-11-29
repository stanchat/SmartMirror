# MagicMirror² on Replit

## Overview
This is a **MagicMirror²** installation running on Replit. MagicMirror² is an open source modular smart mirror platform that displays information like time, weather, calendar, news, and more on a sleek, customizable interface.

**Version:** 2.30.0  
**Language:** Node.js (v20.19.3)  
**Last Updated:** November 29, 2025

## Project Status
The MagicMirror² is fully configured and running on Replit with the following setup:
- Server running on port 5000 (required for Replit)
- Address configured to `0.0.0.0` (required for Replit proxy)
- IP whitelist disabled to allow all connections through Replit's proxy
- All default modules loaded and working

## Project Architecture

### Entry Points
- **Server Mode:** `serveronly/index.js` - Runs MagicMirror² as a web server (current mode)
- **Electron Mode:** `js/electron.js` - Desktop application mode (not used on Replit)

### Key Directories
```
├── config/              - Configuration files
│   └── config.js        - Main configuration (Replit-optimized)
├── modules/             - MagicMirror modules
│   └── default/         - Built-in modules (clock, weather, calendar, etc.)
├── js/                  - Core JavaScript files
│   ├── app.js          - Main application logic
│   ├── server.js       - Express server setup
│   └── server_functions.js - Server helper functions
├── css/                 - Stylesheets
├── fonts/               - Font files
├── translations/        - Language files
└── vendor/              - Third-party dependencies
```

### Core Technologies
- **Express.js** - Web server framework
- **Socket.io** - Real-time bidirectional communication
- **Moment.js** - Date/time manipulation
- **Helmet.js** - Security headers
- **Node-ical** - Calendar parsing
- **Feedme** - RSS/Atom feed parsing

### Active Modules
1. **alert** - Displays notifications
2. **updatenotification** - Shows available updates
3. **clock** - Displays current time and date
4. **calendar** - Shows calendar events from iCal feeds
5. **compliments** - Displays random compliments
6. **weather** - Current weather and forecast (using OpenMeteo)
7. **newsfeed** - RSS news feed reader

## Configuration

### Replit-Specific Settings
The `config/config.js` file has been customized for Replit:

```javascript
{
  address: "0.0.0.0",    // Required for Replit
  port: 5000,            // Required for Replit webview
  ipWhitelist: [],       // Empty to allow Replit's proxy
}
```

### Customization
To customize your MagicMirror:

1. Edit `config/config.js` to:
   - Add/remove modules
   - Change module positions
   - Configure module settings (weather location, calendar feeds, etc.)
   - Modify language, time format, units

2. See the [official documentation](https://docs.magicmirror.builders/configuration/introduction.html) for all configuration options

3. **Important:** Always keep `address: "0.0.0.0"`, `port: 5000`, and `ipWhitelist: []` for Replit compatibility

### Adding Third-Party Modules
MagicMirror² supports community-developed modules. To add them:

1. Clone the module into the `modules/` directory
2. Add the module configuration to `config/config.js`
3. Restart the workflow

Browse available modules at: [MagicMirror² Modules](https://github.com/MichMich/MagicMirror/wiki/3rd-party-modules)

## Development

### Running the Server
The workflow "MagicMirror Server" automatically runs:
```bash
npm run server
```

This starts the server at `http://0.0.0.0:5000`

### Available Scripts
- `npm run server` - Start server-only mode (current)
- `npm run config:check` - Validate configuration file
- `npm test` - Run test suite
- `npm run lint:js` - Lint JavaScript files
- `npm run lint:css` - Lint CSS files

### Debugging
- Check workflow logs in the Replit console for server errors
- Browser console logs show module loading and client-side issues
- Set `logLevel: ["DEBUG", "INFO", "LOG", "WARN", "ERROR"]` in config for verbose logging

## Deployment
The project is configured for Replit deployment with:
- **Deployment Type:** Autoscale (scales based on traffic)
- **Run Command:** `npm run server`
- The same configuration works for both development and production

## Recent Changes
- **2025-11-29:** Initial Replit setup
  - Created `config/config.js` with Replit-optimized settings
  - Configured workflow for port 5000 with webview output
  - Set up deployment configuration
  - Verified all modules load and display correctly

## Resources
- [MagicMirror² Documentation](https://docs.magicmirror.builders)
- [MagicMirror² Forum](https://forum.magicmirror.builders)
- [GitHub Repository](https://github.com/MagicMirrorOrg/MagicMirror)
- [Module Development](https://docs.magicmirror.builders/development/introduction.html)

## User Preferences
None set yet. User preferences and customizations will be documented here.
