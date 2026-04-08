import Foundation

struct AppConfig {
    /// Base URL for your Bkmk instance API
    /// Change this to your Bkmk server URL
    static let apiBaseURL = "https://bkmk.hoshor.me/api"
    
    /// OAuth redirect URI (must match server config)
    /// This is a custom URL scheme that the app will handle
    static let oauthRedirectURI = "bkmkshare://oauth/callback"
    
    /// App Group identifier for sharing data between app and extension
    static let appGroupIdentifier = "group.com.bkmk.share"
    
    /// Keychain service name
    static let keychainService = "com.bkmk.share"
    
    /// UserDefaults key for stored token
    static let tokenKey = "bkmk_api_token"
}
