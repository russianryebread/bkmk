import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var apiManager = APIManager.shared
    
    var body: some View {
        NavigationStack {
            if authManager.isLoggedIn {
                BookmarksListView(
                    bookmarks: apiManager.bookmarks,
                    isLoading: apiManager.isLoading,
                    onRefresh: { await refresh() },
                    onDelete: { bookmark in await deleteBookmark(bookmark) },
                    onToggleFavorite: { bookmark in await toggleFavorite(bookmark) }
                )
            } else {
                LoginView()
            }
        }
        .task {
            if authManager.isLoggedIn {
                await refresh()
            }
        }
    }
    
    private func refresh() async {
        guard let token = authManager.getToken() else { return }
        await apiManager.fetchBookmarks(token: token)
    }
    
    private func deleteBookmark(_ bookmark: Bookmark) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.deleteBookmark(id: bookmark.id, token: token)
    }
    
    private func toggleFavorite(_ bookmark: Bookmark) async {
        guard let token = authManager.getToken() else { return }
        _ = await apiManager.toggleFavorite(id: bookmark.id, token: token)
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
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }
}

// MARK: - Bookmarks List View
struct BookmarksListView: View {
    let bookmarks: [Bookmark]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Bookmark) async -> Void
    let onToggleFavorite: (Bookmark) async -> Void
    
    var body: some View {
        Group {
            if isLoading && bookmarks.isEmpty {
                ProgressView("Loading...")
            } else if bookmarks.isEmpty {
                EmptyBookmarksView()
            } else {
                List {
                    ForEach(bookmarks) { bookmark in
                        NavigationLink(destination: ReaderView(bookmark: bookmark)) {
                            BookmarkRow(bookmark: bookmark)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await onDelete(bookmark) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                Task { await onToggleFavorite(bookmark) }
                            } label: {
                                Label(
                                    bookmark.isFavorite == true ? "Unfavorite" : "Favorite",
                                    systemImage: bookmark.isFavorite == true ? "star.slash" : "star"
                                )
                            }
                            .tint(.yellow)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await onRefresh()
                }
            }
        }
        .navigationTitle("Bookmarks")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await onRefresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
    }
}

struct BookmarkRow: View {
    let bookmark: Bookmark
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(bookmark.title)
                    .font(.headline)
                    .lineLimit(2)
                
                Spacer()
                
                if bookmark.isFavorite == true {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption)
                }
            }
            
            HStack {
                if let domain = bookmark.sourceDomain {
                    Text(domain)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if let minutes = bookmark.readingTimeMinutes, minutes > 0 {
                    Text("•")
                        .foregroundColor(.secondary)
                    Text("\(minutes) min read")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if let description = bookmark.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            if let tags = bookmark.tags, !tags.isEmpty {
                HStack {
                    ForEach(tags.prefix(3), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .foregroundColor(.blue)
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct EmptyBookmarksView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "bookmark")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text("No bookmarks yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Save pages from Safari using the Share button to see them here")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }
}

// MARK: - Reader View
struct ReaderView: View {
    let bookmark: Bookmark
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text(bookmark.title)
                    .font(.title)
                    .fontWeight(.bold)
                
                HStack {
                    if let domain = bookmark.sourceDomain {
                        Text(domain)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    if let minutes = bookmark.readingTimeMinutes, minutes > 0 {
                        Text("•")
                            .foregroundColor(.secondary)
                        Text("\(minutes) min read")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Divider()
                
                if let content = bookmark.cleanedMarkdown {
                    SimpleMarkdownView(markdown: content)
                } else if let description = bookmark.description {
                    Text(description)
                        .font(.body)
                } else {
                    Text("No content available")
                        .foregroundColor(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if let url = URL(string: bookmark.url) {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
    }
}

// MARK: - Simple Markdown View
struct SimpleMarkdownView: View {
    let markdown: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(parseMarkdown(), id: \.id) { element in
                element.view
            }
        }
    }
    
    private func parseMarkdown() -> [MarkdownElement] {
        var elements: [MarkdownElement] = []
        let lines = markdown.components(separatedBy: "\n")
        var codeBlockContent: String?
        
        for line in lines {
            // Code block handling
            if line.hasPrefix("```") {
                if codeBlockContent != nil {
                    elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                        Text(codeBlockContent!)
                            .font(.system(.body, design: .monospaced))
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(8)
                    )))
                    codeBlockContent = nil
                } else {
                    codeBlockContent = ""
                }
                continue
            }
            
            if let codeBlock = codeBlockContent {
                codeBlockContent = codeBlock + (codeBlock.isEmpty ? "" : "\n") + line
                continue
            }
            
            // Headers
            if line.hasPrefix("# ") {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    Text(String(line.dropFirst(2)))
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .padding(.top, 16)
                )))
            } else if line.hasPrefix("## ") {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    Text(String(line.dropFirst(3)))
                        .font(.title)
                        .fontWeight(.bold)
                        .padding(.top, 12)
                )))
            } else if line.hasPrefix("### ") {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    Text(String(line.dropFirst(4)))
                        .font(.title2)
                        .fontWeight(.semibold)
                )))
            }
            // Blockquote
            else if line.hasPrefix("> ") {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(Color.blue)
                            .frame(width: 4)
                        Text(String(line.dropFirst(2)))
                            .italic()
                            .foregroundColor(.secondary)
                    }
                    .padding(.leading, 8)
                )))
            }
            // List item
            else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                        Text(String(line.dropFirst(2)))
                    }
                )))
            }
            // Horizontal rule
            else if line == "---" || line == "***" {
                Divider()
            }
            // Empty line
            else if line.trimmingCharacters(in: .whitespaces).isEmpty {
                // Skip empty lines
            }
            // Paragraph
            else {
                elements.append(MarkdownElement(id: UUID().uuidString, view: AnyView(
                    Text(attributedString(from: line))
                )))
            }
        }
        
        return elements
    }
    
    private func attributedString(from text: String) -> AttributedString {
        var result = text
        
        // Bold: **text**
        while let range = result.range(of: "**") {
            let start = range.lowerBound
            if let endRange = result.range(of: "**", range: range.upperBound..<result.endIndex) {
                let contentStart = result.index(range.upperBound, offsetBy: 0)
                let contentEnd = endRange.lowerBound
                if contentStart < contentEnd {
                    var content = String(result[contentStart..<contentEnd])
                    result.replaceSubrange(start..<endRange.upperBound, with: content)
                }
            }
            break
        }
        
        // Italic: *text*
        while let range = result.range(of: "*") {
            let start = range.lowerBound
            if let endRange = result.range(of: "*", range: range.upperBound..<result.endIndex) {
                let contentStart = result.index(range.upperBound, offsetBy: 0)
                let contentEnd = endRange.lowerBound
                if contentStart < contentEnd {
                    var content = String(result[contentStart..<contentEnd])
                    result.replaceSubrange(start..<endRange.upperBound, with: content)
                }
            }
            break
        }
        
        return AttributedString(result)
    }
}

struct MarkdownElement: Identifiable {
    let id: String
    let view: AnyView
}

#Preview {
    ContentView()
        .environmentObject(AuthManager())
}
