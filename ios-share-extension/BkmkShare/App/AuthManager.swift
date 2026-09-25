import Foundation
import AuthenticationServices

@MainActor
class AuthManager: NSObject, ObservableObject {
    @Published var isLoggedIn = false
    @Published var userEmail: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = AppConfig.apiBaseURL
    private let oauthRedirectURI = AppConfig.oauthRedirectURI
    
    override init() {
        super.init()
        checkLoginStatus()
    }
    
    func checkLoginStatus() {
        if let token = KeychainHelper.shared.getToken() {
            // Keep the user signed in while offline; only a server 401 revokes
            // this revocable API credential.
            isLoggedIn = true
            Task {
                if token.hasPrefix("bkmk_") {
                    await fetchUserInfo(token: token)
                } else if let durableToken = await createMobileToken(sessionToken: token) {
                    KeychainHelper.shared.saveToken(durableToken)
                    await fetchUserInfo(token: durableToken)
                } else {
                    // A prior short-lived session can be upgraded only while
                    // still valid. Keep local cached content usable offline.
                    await fetchUserInfo(token: token)
                }
            }
        }
    }
    
    func loginWithPassword(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        guard let url = URL(string: "\(baseURL)/auth/login") else {
            errorMessage = "Invalid URL"
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["email": email, "password": password]
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    errorMessage = errorResponse.message
                } else {
                    errorMessage = "Login failed"
                }
                isLoading = false
                return
            }
            
            let decoder = JSONDecoder()
            // Try to decode with token first (API request format)
            if let loginResponse = try? decoder.decode(LoginResponse.self, from: data),
               let token = loginResponse.token {
                await handleLogin(token: token)
            } else if let loginResponse = try? decoder.decode(LoginResponseNoToken.self, from: data) {
                // For web response, token is not included unless we send Bearer header
                // Send another request with Bearer to get token
                await loginWithPasswordAPI(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func loginWithPasswordAPI(email: String, password: String) async {
        guard let url = URL(string: "\(baseURL)/auth/login") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer dummy", forHTTPHeaderField: "Authorization")  // Trigger token return
        
        let body = ["email": email, "password": password]
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            if let loginResponse = try? JSONDecoder().decode(LoginResponse.self, from: data),
               let token = loginResponse.token {
                await handleLogin(token: token)
            }
        } catch {
            print("Failed to get token: \(error)")
        }
    }
    
    func login(provider: String) async {
        isLoading = true
        errorMessage = nil
        
        let callbackScheme = "bkmkshare"
        let authURLString = "\(baseURL)/auth/\(provider)?redirect_uri=\(callbackScheme)://oauth/callback"
        guard let authURL = URL(string: authURLString) else {
            errorMessage = "Invalid auth URL"
            isLoading = false
            return
        }
        
        await withCheckedContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                Task { @MainActor in
                    self?.isLoading = false
                    
                    if let error = error {
                        if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin {
                            self?.errorMessage = error.localizedDescription
                        }
                        continuation.resume()
                        return
                    }
                    
                    guard let callbackURL = callbackURL,
                          let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          let token = components.queryItems?.first(where: { $0.name == "token" })?.value else {
                        self?.errorMessage = "Invalid callback"
                        continuation.resume()
                        return
                    }
                    
                    await self?.handleLogin(token: token)
                    continuation.resume()
                }
            }
            
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
    
    private func handleLogin(token: String) async {
        let durableToken = token.hasPrefix("bkmk_") ? token : await createMobileToken(sessionToken: token)
        guard let durableToken else {
            errorMessage = "Could not set up secure app access. Please try signing in again."
            isLoggedIn = false
            return
        }
        KeychainHelper.shared.saveToken(durableToken)
        isLoggedIn = true
        
        Task {
            await fetchUserInfo(token: durableToken)
        }
    }

    private func createMobileToken(sessionToken: String) async -> String? {
        guard let url = URL(string: "\(baseURL)/auth/mobile-token") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return try JSONDecoder().decode(MobileTokenResponse.self, from: data).token
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
    
    /// Updated to handle invalid tokens
    private func fetchUserInfo(token: String) async {
        guard let url = URL(string: "\(baseURL)/auth/me") else { return }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            // Check if the response is an HTTP response
            if let httpResponse = response as? HTTPURLResponse {
                // 401 Unauthorized means the token is invalid or expired
                if httpResponse.statusCode == 401 {
                    print("Token invalid or expired. Logging out...")
                    logout()
                    return
                }
                
                // Optional: Handle other non-success codes
                guard httpResponse.statusCode == 200 else {
                    print("Server returned status code: \(httpResponse.statusCode)")
                    return
                }
            }
            
            // Proceed with decoding user info
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let user = json["user"] as? [String: Any],
               let email = user["email"] as? String {
                userEmail = email
                UserDefaults(suiteName: AppConfig.appGroupIdentifier)?.set(email, forKey: "userEmail")
            }
        } catch {
            print("Network error while fetching user info: \(error)")
            // Note: We don't log out on network errors, only on 401s.
        }
    }
    
    func logout() {
        KeychainHelper.shared.deleteToken()
        isLoggedIn = false
        userEmail = ""
        UserDefaults(suiteName: AppConfig.appGroupIdentifier)?.removeObject(forKey: "userEmail")
    }
    
    func getToken() -> String? {
        return KeychainHelper.shared.getToken()
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding
extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
