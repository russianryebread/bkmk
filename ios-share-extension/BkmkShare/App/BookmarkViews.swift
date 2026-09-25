import SwiftUI
import Textual


// MARK: - Bookmarks List View
struct BookmarksListView: View {
    let bookmarks: [Bookmark]
    let pendingSharedURLs: [PendingSharedURL]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Bookmark) async -> Void
    let onToggleFavorite: (Bookmark) async -> Void
    let onEdit: (Bookmark, String, String) async -> Bool
    
    var body: some View {
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
                    ForEach(bookmarks) { bookmark in
                        NavigationLink(destination: ReaderView(bookmark: bookmark, onEdit: { title, url in await onEdit(bookmark, title, url) })) {
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
    let onEdit: (String, String) async -> Bool
    @State private var isEditing = false

    init(bookmark: Bookmark, onEdit: @escaping (String, String) async -> Bool) {
        _bookmark = State(initialValue: bookmark)
        self.onEdit = onEdit
    }

    private func saveBookmark(title: String, url: String) async -> Bool {
        let saved = await onEdit(title, url)
        if saved {
            bookmark.title = title
            bookmark.url = url
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
                
                // Content Section
                if let content = bookmark.cleanedMarkdown {
                    StructuredText(markdown: content)
                        .fontDesign(.serif)
                        .textSelection(.enabled)
                        .imageScale(.large)
                } else {
                    if let description = bookmark.description {
                        Text(description)
                            .font(.system(.body, design: .serif))
                            .lineSpacing(6)
                    }
                    
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

private struct BookmarkEditorView: View {
    let onSave: (String, String) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var url: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isValidWebURL: Bool {
        guard let components = URLComponents(string: url),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              let host = components.host, !host.isEmpty else { return false }
        return true
    }

    init(bookmark: Bookmark, onSave: @escaping (String, String) async -> Bool) {
        self.onSave = onSave
        _title = State(initialValue: bookmark.title)
        _url = State(initialValue: bookmark.url)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("URL", text: $url).textInputAutocapitalization(.never).keyboardType(.URL)
            }
            .navigationTitle("Edit URL")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task {
                            isSaving = true
                            if await onSave(title, url) { dismiss() }
                            else { errorMessage = "Could not save URL. Check the URL and try again when online." }
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
                Text(description)
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
