import Foundation

struct PendingSharedURL: Codable, Identifiable, Hashable {
    let id: String
    let url: String
    let queuedAt: Date
}

/// A file-coordinated queue shared by the iOS app and its share extension.
/// File coordination prevents an extension write and app removal from
/// overwriting each other when both processes are active.
enum SharedURLQueue {
    private static let filename = "pending_shared_urls.json"
    private static let lock = NSRecursiveLock()

    private static var queueFileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: AppConfig.sharedContainerIdentifier)?
            .appendingPathComponent(filename)
    }

    static func all() -> [PendingSharedURL] {
        lock.lock()
        defer { lock.unlock() }
        return readItems()
    }

    @discardableResult
    static func enqueue(_ rawURL: String) -> PendingSharedURL? {
        guard let normalized = normalizedURL(rawURL) else { return nil }
        lock.lock()
        defer { lock.unlock() }
        var queuedItem: PendingSharedURL?
        let wroteItems = modifyItems { items in
            if let existing = items.first(where: { $0.id == normalized }) {
                queuedItem = existing
                return items
            }
            let item = PendingSharedURL(id: normalized, url: rawURL, queuedAt: Date())
            queuedItem = item
            return items + [item]
        }
        return wroteItems ? queuedItem : nil
    }

    static func remove(id: String) {
        lock.lock()
        defer { lock.unlock() }
        modifyItems { $0.filter { $0.id != id } }
    }

    private static func normalizedURL(_ rawURL: String) -> String? {
        guard var components = URLComponents(string: rawURL),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              let host = components.host?.lowercased(), !host.isEmpty else { return nil }
        components.scheme = scheme
        components.host = host
        if (scheme == "https" && components.port == 443) || (scheme == "http" && components.port == 80) {
            components.port = nil
        }
        if components.path.count > 1 && components.path.hasSuffix("/") {
            components.path.removeLast()
        }
        components.fragment = nil
        return components.string
    }

    private static func readItems() -> [PendingSharedURL] {
        guard let fileURL = queueFileURL else { return [] }
        var result: [PendingSharedURL] = []
        var coordinationError: NSError?
        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: fileURL, options: [], error: &coordinationError) { coordinatedURL in
            if let data = try? Data(contentsOf: coordinatedURL) {
                result = (try? JSONDecoder().decode([PendingSharedURL].self, from: data)) ?? []
            }
        }
        return result
    }

    @discardableResult
    private static func modifyItems(_ transform: ([PendingSharedURL]) -> [PendingSharedURL]) -> Bool {
        guard let fileURL = queueFileURL else { return false }
        var succeeded = false
        var coordinationError: NSError?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: fileURL, options: [], error: &coordinationError) { coordinatedURL in
            do {
                let fileExists = FileManager.default.fileExists(atPath: coordinatedURL.path)
                let existingData = try? Data(contentsOf: coordinatedURL)
                let existingItems: [PendingSharedURL]
                if fileExists {
                    guard let existingData,
                          let decoded = try? JSONDecoder().decode([PendingSharedURL].self, from: existingData) else {
                        return
                    }
                    existingItems = decoded
                } else {
                    existingItems = []
                }
                let items = transform(existingItems)
                let data = try JSONEncoder().encode(items)
                try data.write(to: coordinatedURL, options: .atomic)
                succeeded = true
            } catch {
                succeeded = false
            }
        }
        return succeeded
    }
}

struct AppConfig {
    /// Base URL for your Bkmk instance API
    /// Change this to your Bkmk server URL
    static let apiBaseURL = "https://bkmk.hoshor.me/api"
    
    /// OAuth redirect URI (must match server config)
    /// This is a custom URL scheme that the app will handle
    static let oauthRedirectURI = "bkmkshare://oauth/callback"
    
    /// App Group identifier for sharing data between app and extension
    static let appGroupIdentifier = "group.com.bkmk.share"

    /// Shared container enabled in both app and extension entitlements.
    static let sharedContainerIdentifier = appGroupIdentifier
    
    /// Keychain service name
    static let keychainService = "me.hoshor.bkmk.share"
    
    /// UserDefaults key for stored token
    static let tokenKey = "bkmk_api_token"
}
