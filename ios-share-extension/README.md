# Bkmk Share Extension

An iOS Share Extension to quickly save Safari bookmarks to your Bkmk instance.

## Features

- One-tap saving from Safari's share sheet
- Supports any app that shares URLs
- Configurable API endpoint
- Secure token storage in Keychain
- Success/failure feedback

## Setup

### Prerequisites

- Xcode 15+
- Apple Developer Account (for running on device)
- A running Bkmk instance

### Configuration

1. Open `BkmkShare.xcodeproj` in Xcode
2. Update `BkmkShare/AppConfig.swift`:
   ```swift
   static let apiBaseURL = "https://your-bkmk-instance.com/api"
   ```
3. Get your API token from Bkmk web app (Settings or Profile)
4. Update `BkmkShare/ShareViewController.swift` with your token:
   ```swift
   private let apiToken = "your-api-token-here"
   ```

### Building & Running

1. Select your development team in Xcode (Signing & Capabilities)
2. Select a simulator or device
3. Build and run (⌘R)

### Using the Extension

1. Open Safari on iOS
2. Navigate to any webpage
3. Tap the Share button
4. Select "Save to Bkmk" from the share sheet
5. See confirmation of save

## Architecture

- **Main App**: Simple container for settings and token configuration
- **Share Extension**: Receives URLs and posts to Bkmk API
- **Shared**: Keychain helper for secure token storage

## Requirements

- iOS 15.0+
- Swift 5.9+

## Files

```
BkmkShare/
├── App/
│   ├── BkmkShareApp.swift          # SwiftUI app entry
│   ├── ContentView.swift           # Main app view
│   └── AppConfig.swift             # API configuration
├── ShareExtension/
│   ├── ShareViewController.swift   # Share extension entry
│   └── Info.plist                  # Extension configuration
├── Shared/
│   └── KeychainHelper.swift        # Keychain access
├── Assets.xcassets/
└── project.yml                     # XcodeGen config
```
