import SwiftUI
import Textual


// MARK: - Notes List View
struct NotesListView: View {
    let notes: [Note]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Note) async -> Void
    let onToggleFavorite: (Note) async -> Void
    let onEdit: (Note, String) async -> Bool
    
    var body: some View {
        Group {
            if isLoading && notes.isEmpty {
                ProgressView("Loading...")
            } else if notes.isEmpty {
                EmptyNotesView()
            } else {
                List {
                    ForEach(notes) { note in
                        NavigationLink(destination: NoteView(note: note, onEdit: { content in await onEdit(note, content) })) {
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
    @State private var note: Note
    let onEdit: (String) async -> Bool
    @State private var isEditing = false

    init(note: Note, onEdit: @escaping (String) async -> Bool) {
        _note = State(initialValue: note)
        self.onEdit = onEdit
    }

    private func saveContent(_ content: String) async -> Bool {
        let saved = await onEdit(content)
        if saved { note.content = content }
        return saved
    }
    
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
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Edit") { isEditing = true }
            }
        }
        .sheet(isPresented: $isEditing) {
            NoteEditorView(note: note, onSave: saveContent)
        }
    }
}

private struct NoteEditorView: View {
    let note: Note
    let onSave: (String) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var content: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(note: Note, onSave: @escaping (String) async -> Bool) {
        self.note = note
        self.onSave = onSave
        _content = State(initialValue: note.content)
    }

    var body: some View {
        NavigationStack {
            TextEditor(text: $content)
                .font(.system(.body, design: .serif))
                .padding(8)
                .navigationTitle("Edit Note")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(isSaving ? "Saving…" : "Save") {
                            Task {
                                isSaving = true
                                if await onSave(content) { dismiss() }
                                else { errorMessage = "Could not save note. Try again when online." }
                                isSaving = false
                            }
                        }.disabled(isSaving || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                .alert("Save failed", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                    Button("OK", role: .cancel) { errorMessage = nil }
                } message: { Text(errorMessage ?? "") }
        }
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
