import SwiftUI
import Textual
import WebKit


// MARK: - Bookmarks List View
struct BookmarksListView: View {
    let bookmarks: [Bookmark]
    let pendingSharedURLs: [PendingSharedURL]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Bookmark) async -> Void
    let onToggleFavorite: (Bookmark) async -> Void
    let onEdit: (Bookmark, String, String, String) async -> Bool
    @State private var searchText = ""
    @State private var favoritesOnly = false
    @State private var selectedTag: String?
    @State private var bookmarkToDelete: Bookmark?

    private var availableTags: [String] {
        Array(Set(bookmarks.flatMap { $0.tags ?? [] }))
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    private var filteredBookmarks: [Bookmark] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return bookmarks.filter { bookmark in
            if favoritesOnly && bookmark.isFavorite != true { return false }
            if let selectedTag, !(bookmark.tags ?? []).contains(where: { $0.caseInsensitiveCompare(selectedTag) == .orderedSame }) { return false }
            guard !query.isEmpty else { return true }
            return [bookmark.title, bookmark.url, bookmark.description ?? "", bookmark.cleanedMarkdown ?? ""]
                .contains { $0.localizedCaseInsensitiveContains(query) }
                || (bookmark.tags ?? []).contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search bookmarks", text: $searchText)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(10)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 16)
            .padding(.top, 8)

            if !searchText.isEmpty || favoritesOnly || selectedTag != nil {
                HStack {
                    if favoritesOnly { Text("Favorites") }
                    if let selectedTag { Text(selectedTag) }
                    Spacer()
                    Button("Clear filters") {
                        searchText = ""
                        favoritesOnly = false
                        selectedTag = nil
                    }
                }
                .font(.subheadline)
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
            }

            Group {
                if isLoading && bookmarks.isEmpty {
                    ProgressView("Loading...")
                } else if bookmarks.isEmpty && pendingSharedURLs.isEmpty {
                    EmptyBookmarksView()
                } else {
                    List {
                        if !pendingSharedURLs.isEmpty {
                            Section("Waiting to sync") {
                                ForEach(pendingSharedURLs) { item in
                                    PendingSharedURLRow(item: item)
                                }
                            }
                        }
                        ForEach(filteredBookmarks) { bookmark in
                            NavigationLink(destination: ReaderView(bookmark: bookmark, onEdit: { title, url, description in await onEdit(bookmark, title, url, description) })) {
                                BookmarkRow(bookmark: bookmark)
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    bookmarkToDelete = bookmark
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
                        if filteredBookmarks.isEmpty {
                            Text("No bookmarks match your search or filters")
                                .foregroundColor(.secondary)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await onRefresh()
                    }
                }
            }
        }
        .navigationTitle("Bookmarks")
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                ListFilterMenu(tags: availableTags, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag)
                Button {
                    Task { await onRefresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .alert("Delete bookmark?", isPresented: Binding(
            get: { bookmarkToDelete != nil },
            set: { if !$0 { bookmarkToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let bookmark = bookmarkToDelete else { return }
                bookmarkToDelete = nil
                Task { await onDelete(bookmark) }
            }
            Button("Cancel", role: .cancel) { bookmarkToDelete = nil }
        } message: {
            Text("This bookmark will be deleted and synced when online.")
        }
    }
}

private struct PendingSharedURLRow: View {
    let item: PendingSharedURL

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundColor(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text(URL(string: item.url)?.host ?? item.url)
                    .font(.system(.subheadline, design: .serif))
                    .lineLimit(1)
                Text(item.url)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Text("Saved on this device · will sync online")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Spacer(minLength: 0)
            if let url = URL(string: item.url) {
                Link(destination: url) {
                    Image(systemName: "arrow.up.right.square")
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
    @State private var bookmark: Bookmark
    let onEdit: (String, String, String) async -> Bool
    @State private var isEditing = false
    @State private var isPlayingVideo = false

    private var youtubeVideo: YouTubeVideo? { YouTubeVideo(url: bookmark.url) }

    init(bookmark: Bookmark, onEdit: @escaping (String, String, String) async -> Bool) {
        _bookmark = State(initialValue: bookmark)
        self.onEdit = onEdit
    }

    private func saveBookmark(title: String, url: String, description: String) async -> Bool {
        let saved = await onEdit(title, url, description)
        if saved {
            bookmark.title = title
            bookmark.url = url
            bookmark.description = description
        }
        return saved
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Section
                VStack(alignment: .leading, spacing: 8) {
                    Text(bookmark.title)
                        .font(.system(.title, design: .serif))
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    HStack {
                        if let domain = bookmark.sourceDomain {
                            Button(action: {
                                UIApplication.shared.open(URL(string: bookmark.url)!)
                            }) {
                                Text(domain.uppercased())
                                    .font(.system(.caption))
                                    .fontWeight(.medium)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        if let minutes = bookmark.readingTimeMinutes, minutes > 0 {
                            Text("•")
                            Text("\(minutes) MIN READ")
                                .font(.system(.caption))
                        }
                    }
                    .foregroundColor(.secondary)
                }
                
                Divider()

                if let video = youtubeVideo {
                    if isPlayingVideo {
                        YouTubePlayer(video: video)
                            .aspectRatio(16 / 9, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        Button {
                            isPlayingVideo = true
                        } label: {
                            Label("Play video", systemImage: "play.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 180)
                                .foregroundColor(.white)
                                .background(Color.black, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                    if let url = URL(string: bookmark.url) {
                        Link("Open on YouTube", destination: url)
                            .font(.subheadline)
                    }
                }
                
                // Content Section
                if let description = bookmark.description, !description.isEmpty {
                    Text(description)
                        .font(.system(.body, design: .serif))
                        .foregroundColor(.secondary)
                }
                if youtubeVideo == nil, let content = bookmark.cleanedMarkdown {
                    MarkdownReader(markdown: content)
                } else if youtubeVideo == nil {
                    Divider()
                    
                    HStack {
                        Spacer()
                        Button(action: {
                            UIApplication.shared.open(URL(string: bookmark.url)!)
                        }) {
                            Text(bookmark.url)
                                .foregroundColor(.white)
                                .padding()
                                .background(Color.blue)
                                .cornerRadius(8)
                            
                        }
                        Spacer()
                    }
                }
            }
            .padding(24)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button("Edit") { isEditing = true }
                    if let url = URL(string: bookmark.url) { ShareLink(item: url) }
                }
            }
        }
        .sheet(isPresented: $isEditing) {
            BookmarkEditorView(bookmark: bookmark, onSave: saveBookmark)
        }
    }
}

private struct YouTubeVideo {
    let id: String

    init?(url raw: String) {
        guard let url = URLComponents(string: raw),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              let rawHost = url.host?.lowercased() else { return nil }
        let host = rawHost.hasPrefix("www.") ? String(rawHost.dropFirst(4)) : rawHost
        let segments = url.path.split(separator: "/").map(String.init)
        let candidate: String?
        if host == "youtu.be" {
            candidate = segments.first
        } else if host == "youtube.com" || host.hasSuffix(".youtube.com") || host == "youtube-nocookie.com" || host.hasSuffix(".youtube-nocookie.com") {
            if segments.first == "watch" {
                candidate = url.queryItems?.first(where: { $0.name == "v" })?.value
            } else if let first = segments.first, ["shorts", "embed", "v", "live"].contains(first), segments.count > 1 {
                candidate = segments[1]
            } else {
                candidate = nil
            }
        } else {
            candidate = nil
        }
        guard let candidate, candidate.range(of: #"^[A-Za-z0-9_-]{11}$"#, options: .regularExpression) != nil else { return nil }
        id = candidate
    }

    var embedURL: URL { URL(string: "https://www.youtube-nocookie.com/embed/\(id)?playsinline=1&autoplay=1")! }
}

private struct YouTubePlayer: UIViewRepresentable {
    let video: YouTubeVideo

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.scrollView.isScrollEnabled = false
        view.load(URLRequest(url: video.embedURL))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}

struct ListFilterMenu: View {
    let tags: [String]
    @Binding var favoritesOnly: Bool
    @Binding var selectedTag: String?

    var body: some View {
        Menu {
            Button {
                favoritesOnly.toggle()
            } label: {
                Label("Favorites", systemImage: favoritesOnly ? "checkmark" : "star")
            }
            Divider()
            Button {
                selectedTag = nil
            } label: {
                Label("All tags", systemImage: selectedTag == nil ? "checkmark" : "tag")
            }
            ForEach(tags, id: \.self) { tag in
                Button {
                    selectedTag = tag
                } label: {
                    Label(tag, systemImage: selectedTag == tag ? "checkmark" : "tag")
                }
            }
        } label: {
            Image(systemName: favoritesOnly || selectedTag != nil ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
        }
        .accessibilityLabel("Filter list")
    }
}

private struct BookmarkEditorView: View {
    let onSave: (String, String, String) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var url: String
    @State private var description: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isValidWebURL: Bool {
        guard let components = URLComponents(string: url),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              let host = components.host, !host.isEmpty else { return false }
        return true
    }

    init(bookmark: Bookmark, onSave: @escaping (String, String, String) async -> Bool) {
        self.onSave = onSave
        _title = State(initialValue: bookmark.title)
        _url = State(initialValue: bookmark.url)
        _description = State(initialValue: bookmark.description ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("URL", text: $url).textInputAutocapitalization(.never).keyboardType(.URL)
                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle("Edit Bookmark")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task {
                            isSaving = true
                            if await onSave(title, url, description) { dismiss() }
                            else { errorMessage = "Could not save bookmark. Check the URL and try again when online." }
                            isSaving = false
                        }
                    }.disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !isValidWebURL)
                }
            }
            .alert("Save failed", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }
}

// MARK: - Simplified Row
struct BookmarkRow: View {
    let bookmark: Bookmark
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(bookmark.title)
                .font(.system(.headline, design: .serif))
                .lineLimit(2)
            
            if let description = bookmark.description, !description.isEmpty {
                Text(markdownPlainText(description))
                    .font(.system(.subheadline, design: .serif))
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            HStack(spacing: 8) {
                if bookmark.isFavorite == true {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption2)
                }
                
                Text(bookmark.sourceDomain ?? "")
                Text("•")
                Text("\(bookmark.readingTimeMinutes ?? 0) min")
            }
            .font(.system(.caption2))
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}
