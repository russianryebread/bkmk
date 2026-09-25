import Foundation
import Security

/// Helper class for secure storage in Keychain
/// Uses shared access group for app + extension
class KeychainHelper {
    static let shared = KeychainHelper()

    // A registered App Group is itself a shared Keychain group on iOS.
    // Keeping this identifier also lets existing sessions upgrade in place.
    private let keychainAccessGroup = AppConfig.appGroupIdentifier
    
    private init() {}
    
    /// Save token to Keychain
    func saveToken(_ token: String) {
        guard let data = token.data(using: .utf8) else { return }
        
        // Delete existing token first
        deleteToken()
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConfig.keychainService,
            kSecAttrAccount as String: "api_token",
            kSecAttrAccessGroup as String: keychainAccessGroup,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            print("Keychain save error: \(status)")
        }
    }
    
    /// Get token from Keychain
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConfig.keychainService,
            kSecAttrAccount as String: "api_token",
            kSecAttrAccessGroup as String: keychainAccessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    /// Delete token from Keychain
    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConfig.keychainService,
            kSecAttrAccount as String: "api_token",
            kSecAttrAccessGroup as String: keychainAccessGroup
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}
