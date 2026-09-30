import SwiftUI

@main
struct BkmkApp: App {
    @StateObject private var authManager = AuthManager()

    init() {
        UIRefreshControl.appearance().tintColor = .white
        UIRefreshControl.appearance().backgroundColor = LibraryAppearance.uiBlue
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
        }
    }
}
