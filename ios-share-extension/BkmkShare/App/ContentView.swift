import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var apiManager = APIManager.shared
    @Environment(\.scenePhase) private var scenePhase
    
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
                            pendingSharedURLs: apiManager.pendingSharedURLs,
                            isLoading: apiManager.isLoading,
                            onRefresh: { await refreshBookmarks() },
                            onDelete: { bookmark in await deleteBookmark(bookmark) },
                            onToggleFavorite: { bookmark in await favoriteBookmark(bookmark) },
                            onCreate: { title, url, description in await createBookmark(title: title, url: url, description: description) },
                            onEdit: { bookmark, title, url, description in await editBookmark(bookmark, title: title, url: url, description: description) }
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
                            onToggleFavorite: { note in await favoriteNote(note) },
                            onCreate: { content in await createNote(content: content) },
                            onEdit: { note, content in await editNote(note, content: content) }
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
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            apiManager.refreshPendingSharedURLs()
            if authManager.isLoggedIn {
                Task { await refreshBookmarks() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let error = apiManager.errorMessage, authManager.isLoggedIn {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.circle")
                    Text(error)
                        .font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        apiManager.errorMessage = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.weight(.bold))
                            .padding(8)
                    }
                    .accessibilityLabel("Dismiss error")
                }
                .foregroundColor(.primary)
                .padding(.leading, 16)
                .padding(.trailing, 8)
                .padding(.vertical, 10)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.secondary.opacity(0.25)))
                .shadow(radius: 8, y: 3)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .task(id: error) {
                    try? await Task.sleep(nanoseconds: 7_000_000_000)
                    if !Task.isCancelled && apiManager.errorMessage == error {
                        apiManager.errorMessage = nil
                    }
                }
            }
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

    private func editBookmark(_ bookmark: Bookmark, title: String, url: String, description: String) async -> Bool {
        guard let token = authManager.getToken() else { return false }
        return await apiManager.updateBookmark(id: bookmark.id, title: title, url: url, description: description, token: token)
    }

    private func createBookmark(title: String, url: String, description: String) async -> Bool {
        guard let token = authManager.getToken() else { return false }
        return await apiManager.createBookmark(title: title, url: url, description: description, token: token)
    }

    private func createNote(content: String) async -> Bool {
        guard let token = authManager.getToken() else { return false }
        return await apiManager.createNote(content: content, token: token)
    }

    private func editNote(_ note: Note, content: String) async -> Bool {
        guard let token = authManager.getToken() else { return false }
        return await apiManager.updateNote(id: note.id, content: content, token: token)
    }
}

// MARK: - Login View
struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showPasswordLogin = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Spacer(minLength: 48)

                VStack(spacing: 14) {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundColor(.primary)
                        .frame(width: 72, height: 72)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))

                    Text("Bkmk")
                        .font(.system(.largeTitle, design: .serif, weight: .bold))

                    Text("Your bookmarks and notes, wherever you are.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    if showPasswordLogin {
                        PasswordLoginView(email: $email, password: $password)
                    } else {
                        OAuthButton(provider: "GitHub", icon: "person.circle") {
                            Task { await authManager.login(provider: "github") }
                        }
                        OAuthButton(provider: "Google", icon: "globe") {
                            Task { await authManager.login(provider: "google") }
                        }
                        OAuthButton(provider: "Apple", icon: "apple.logo") {
                            Task { await authManager.login(provider: "apple") }
                        }
                    }

                    Button(showPasswordLogin ? "Other sign-in options" : "Sign in with email") {
                        authManager.errorMessage = nil
                        withAnimation { showPasswordLogin.toggle() }
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.primary)
                    .padding(.top, 10)

                    if let error = authManager.errorMessage {
                        HStack(spacing: 8) {
                            Text(error).frame(maxWidth: .infinity, alignment: .leading)
                            Button {
                                authManager.errorMessage = nil
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                            }
                            .accessibilityLabel("Dismiss error")
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(12)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .frame(maxWidth: 360)

                Spacer(minLength: 32)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
        }
        .background(Color(.systemBackground))
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
            
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
                .textContentType(.password)
            
            Button {
                Task {
                    await authManager.loginWithPassword(email: email, password: password)
                }
            } label: {
                HStack {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(Color(.systemBackground))
                    }
                    Text("Sign In")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.primary)
                .foregroundColor(Color(.systemBackground))
                .cornerRadius(12)
            }
            .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)
        }
    }
}


// MARK: - Login Components (Styled)
struct OAuthButton: View {
    let provider: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon).frame(width: 24)
                Text("Continue with \(provider)")
                    .fontWeight(.medium)
            }
            .font(.body)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .padding(.horizontal, 16)
            .background(Color(.secondarySystemBackground))
            .foregroundColor(.primary)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.08)))
        }
    }
}
