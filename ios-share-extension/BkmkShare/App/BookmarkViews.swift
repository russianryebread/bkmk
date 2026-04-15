import SwiftUI
import Textual


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
                if let url = URL(string: bookmark.url) {
                    ShareLink(item: url)
                }
            }
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
