# BkmkShare iOS App

## Setup Instructions

### 1. Install XcodeGen (Required for project generation)

```bash
brew install xcodegen
```

Then generate the project:
```bash
cd ios-share-extension
xcodegen generate
```

### 2. Adding Textual Package

If XcodeGen is not available, manually add the package in Xcode:

1. Open `BkmkShare.xcodeproj`
2. Select the **BkmkShare** project in the navigator
3. Go to **File → Add Package Dependencies**
4. Search for: `Textual` by **SimonBS**
5. Set the package product to: `Textual`
6. Add to target: **BkmkShare**

### 3. Build & Run

1. Open `BkmkShare.xcodeproj` in Xcode
2. Wait for Swift Package Manager to fetch dependencies
3. Select a simulator or device
4. Build and run (Cmd+R)

## Features

- OAuth login (GitHub, Google, Apple)
- Email/password login
- View saved bookmarks
- Read bookmark content with markdown rendering
- Swipe to delete/favorite bookmarks
- Pull to refresh
- Share bookmarks

## Architecture

- **SwiftUI** - UI framework
- **Textual** - Markdown rendering
- **Keychain** - Secure token storage
- **App Groups** - Data sharing with Share Extension
