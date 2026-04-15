import SwiftUI
import Textual

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var apiManager = APIManager.shared
    
    // Track which tab is currently selected
    @State private var selectedTab = 0
    
    var body: some View {
        Group {
            if authManager.isLoggedIn {
                TabView(selection: $selectedTab) {
                    
                    // --- TAB 1: BOOKMARKS ---
                    NavigationStack {
                        BookmarksListView(
                            bookmarks: apiManager.bookmarks,
                            isLoading: apiManager.isLoading,
                            onRefresh: { await refreshBookmarks() },
                            onDelete: { bookmark in await deleteBookmark(bookmark) },
                            onToggleFavorite: { bookmark in await favoriteBookmark(bookmark) }
                        )
                        .navigationTitle("Bookmarks")
                    }
                    .tabItem {
                        Label("Bookmarks", systemImage: "bookmark.fill")
                    }
                    .tag(0)
                    
                    // --- TAB 2: NOTES ---
                    NavigationStack {
                        NotesListView(
                            notes: apiManager.notes,
                            isLoading: apiManager.isLoading,
                            onRefresh: { await refreshNotes() },
                            onDelete: { note in await deleteNote(note) },
                            onToggleFavorite: { note in await favoriteNote(note) }
                        )
                        .navigationTitle("Notes")
                    }
                    .tabItem {
                        Label("Notes", systemImage: "note.text")
                    }
                    .tag(1)
                }
            } else {
                LoginView()
            }
        }
        .task {
            if authManager.isLoggedIn {
                await refreshBookmarks()
                await refreshNotes()
            }
        }
        
        if let error = apiManager.errorMessage {
            Text(error)
                .font(.callout)
                .foregroundColor(.white)
                .padding(.horizontal)
                .padding(.vertical, 6)
                .background(Color.red)
                //.frame(maxWidth: .infinity)
                .cornerRadius(6)
        }
    }
    
    // MARK: - API Actions
    private func refreshBookmarks() async {
        guard let token = authManager.getToken() else { return }
        await apiManager.fetchBookmarks(token: token)
    }
    
    private func refreshNotes() async {
        guard let token = authManager.getToken() else { return }
        // Adjust this to your actual APIManager method
        await apiManager.fetchNotes(token: token)
    }
    
    private func deleteBookmark(_ bookmark: Bookmark) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.deleteBookmark(id: bookmark.id, token: token)
    }
    
    private func favoriteBookmark(_ bookmark: Bookmark) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.favoriteBookmark(id: bookmark.id, token: token)
    }
    
    private func deleteNote(_ note: Note) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.deleteNote(id: note.id, token: token)
    }
    
    private func favoriteNote(_ note: Note) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.favoriteNote(id: note.id, token: token)
    }
}

// MARK: - Login View
struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showPasswordLogin = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Spacer()
                        .frame(height: 20)
                    
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    
                    Text("Bkmk")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Save bookmarks from Safari and read them anywhere")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    if showPasswordLogin {
                        PasswordLoginView(email: $email, password: $password)
                    } else {
                        VStack(spacing: 12) {
                            OAuthButton(provider: "GitHub", icon: "person.circle", color: .black) {
                                Task { await authManager.login(provider: "github") }
                            }
                            
                            OAuthButton(provider: "Google", icon: "globe", color: .green) {
                                Task { await authManager.login(provider: "google") }
                            }
                            
                            OAuthButton(provider: "Apple", icon: "apple.logo", color: .black) {
                                Task { await authManager.login(provider: "apple") }
                            }
                        }
                    }
                    
                    Button(showPasswordLogin ? "Use OAuth instead" : "Sign in with Email") {
                        withAnimation {
                            showPasswordLogin.toggle()
                        }
                    }
                    .font(.subheadline)
                    
                    if let error = authManager.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }
                    
                    Spacer()
                }
                .padding(.horizontal)
            }
            .navigationBarHidden(true)
        }
    }
}

struct PasswordLoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @Binding var email: String
    @Binding var password: String
    
    var body: some View {
        VStack(spacing: 16) {
            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .padding(.horizontal)
            
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
                .textContentType(.password)
                .padding(.horizontal)
            
            Button {
                Task {
                    await authManager.loginWithPassword(email: email, password: password)
                }
            } label: {
                HStack {
                    if authManager.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text("Sign In")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(email.isEmpty || password.isEmpty)
            .padding(.horizontal)
        }
    }
}


// MARK: - Login Components (Styled)
struct OAuthButton: View {
    let provider: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text("Continue with \(provider)")
                    .fontWeight(.medium)
            }
            .font(.system(.body, design: .serif))
            .frame(maxWidth: .infinity)
            .padding()
            .background(color)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }
}
