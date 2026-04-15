import SwiftUI
import Textual


// MARK: - Notes List View
struct NotesListView: View {
    let notes: [Note]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Note) async -> Void
    let onToggleFavorite: (Note) async -> Void
    
    var body: some View {
        Group {
            if isLoading && notes.isEmpty {
                ProgressView("Loading...")
            } else if notes.isEmpty {
                EmptyNotesView()
            } else {
                List {
                    ForEach(notes) { note in
                        NavigationLink(destination: NoteView(note: note)) {
                            NoteRow(note: note)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await onDelete(note) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                Task { await onToggleFavorite(note) }
                            } label: {
                                Label(
                                    note.isFavorite == true ? "Unfavorite" : "Favorite",
                                    systemImage: note.isFavorite == true ? "star.slash" : "star"
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
        .navigationTitle("Notes")
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

struct EmptyNotesView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "note")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text("No notes yet")
                .font(.title2)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Reader View
struct NoteView: View {
    let note: Note
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(noteTitle(note.content))
                        .font(.system(.title, design: .serif))
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                }
                
                Divider()

                StructuredText(markdown: note.content)
                    .fontDesign(.serif)
                    .textSelection(.enabled)
                    .imageScale(.large)
                
            }
            .padding(24)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Simplified Row
struct NoteRow: View {
    let note: Note
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(noteTitle(note.content))
                .font(.system(.headline, design: .serif))
                .lineLimit(2)
            
            Text(note.content)
                .font(.system(.subheadline, design: .serif))
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            HStack(spacing: 8) {
                if note.isFavorite == true {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption2)
                }
            }
            .font(.system(.caption2))
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

func noteTitle(_ string: String, maxChars: Int = 64, trailing: String = "…") -> String {
    let firstLine = string.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
    guard firstLine.count > maxChars else { return firstLine }
    var cutoff = firstLine.index(firstLine.startIndex, offsetBy: maxChars)
    if let lastSpace = firstLine[..<cutoff].lastIndex(of: " ") {
        cutoff = lastSpace
    }
    return String(firstLine[..<cutoff]).trimmingCharacters(in: .whitespaces) + trailing
}
