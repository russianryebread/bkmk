import SwiftUI
import Textual
import UIKit

struct MarkdownReader: View {
    @EnvironmentObject private var authManager: AuthManager
    let markdown: String

    private var baseURL: URL {
        URL(string: AppConfig.apiBaseURL)!.deletingLastPathComponent()
    }

    var body: some View {
        StructuredText(markdown: markdown, baseURL: baseURL)
            .textual.imageAttachmentLoader(AuthenticatedImageLoader(baseURL: baseURL, token: authManager.getToken()))
            .fontDesign(.serif)
            .textSelection(.enabled)
            .imageScale(.large)
    }
}

private struct AuthenticatedImageLoader: AttachmentLoader {
    let baseURL: URL
    let token: String?

    func attachment(for url: URL, text: String, environment: ColorEnvironmentValues) async throws -> NativeImageAttachment {
        guard let imageURL = URL(string: url.absoluteString, relativeTo: baseURL)?.absoluteURL,
              ["http", "https"].contains(imageURL.scheme?.lowercased() ?? "") else {
            throw URLError(.unsupportedURL)
        }
        var request = URLRequest(url: imageURL)
        request.setValue("image/*", forHTTPHeaderField: "Accept")
        if imageURL.host?.lowercased() == baseURL.host?.lowercased(),
           imageURL.path.hasPrefix("/api/images/"), let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        if let response = response as? HTTPURLResponse, !(200...299).contains(response.statusCode) {
            throw URLError(.badServerResponse)
        }
        guard let image = UIImage(data: data), image.size.width > 0, image.size.height > 0 else {
            throw URLError(.cannotDecodeContentData)
        }
        return NativeImageAttachment(data: data, text: text, imageSize: image.size)
    }
}

private struct NativeImageAttachment: Textual.Attachment {
    let data: Data
    let text: String
    let imageSize: CGSize

    var description: String { text }

    var body: some View {
        Image(uiImage: UIImage(data: data) ?? UIImage())
            .resizable()
    }

    func sizeThatFits(_ proposal: ProposedViewSize, in environment: TextEnvironmentValues) -> CGSize {
        let width = min(proposal.width ?? imageSize.width, imageSize.width)
        return CGSize(width: width, height: width * imageSize.height / imageSize.width)
    }
}


// MARK: - Notes List View
struct NotesListView: View {
    let notes: [Note]
    let isLoading: Bool
    let onRefresh: () async -> Void
    let onDelete: (Note) async -> Void
    let onToggleFavorite: (Note) async -> Void
    let onCreate: (String) async -> Bool
    let onEdit: (Note, String) async -> Bool
    @State private var searchText = ""
    @State private var favoritesOnly = false
    @State private var selectedTag: String?
    @State private var noteToDelete: Note?
    @State private var showingCreate = false
    @State private var searchTransitionProgress: CGFloat = 0
    @State private var hasMeasuredSearch = false

    private var availableTags: [String] {
        Array(Set(notes.flatMap { $0.tags ?? [] }))
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    private var filteredNotes: [Note] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return notes.filter { note in
            if favoritesOnly && note.isFavorite != true { return false }
            if let selectedTag, !(note.tags ?? []).contains(where: { $0.caseInsensitiveCompare(selectedTag) == .orderedSame }) { return false }
            guard !query.isEmpty else { return true }
            return markdownPlainText(note.content).localizedCaseInsensitiveContains(query)
                || (note.tags ?? []).contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }
    
    var body: some View {
        List {
            LibraryTitleRow(title: "Notes", onRefresh: onRefresh)
                .listRowInsets(EdgeInsets())
                .listRowBackground(LibraryAppearance.blue)
                .listRowSeparator(.hidden)

            LibrarySearchHeader(title: "Search notes", tags: availableTags, transitionProgress: searchTransitionProgress, searchText: $searchText, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag)
                .background(GeometryReader { geometry in
                    Color.clear.preference(key: LibrarySearchTopPreference.self, value: geometry.frame(in: .named("libraryScroll")).minY)
                })
                .listRowInsets(EdgeInsets())
                .listRowBackground(LibraryAppearance.blue)
                .listRowSeparator(.hidden)

            LibraryFilterRow(tags: availableTags, searchText: $searchText, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag)
                .listRowSeparator(.hidden)
            if isLoading && notes.isEmpty {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity)
            } else if notes.isEmpty {
                EmptyNotesView()
            } else {
                ForEach(filteredNotes) { note in
                    NavigationLink(destination: NoteView(note: note, onEdit: { content in await onEdit(note, content) })) {
                        NoteRow(note: note)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            noteToDelete = note
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
                if filteredNotes.isEmpty {
                    Text("No notes match your search or filters")
                        .foregroundColor(.secondary)
                }
            }
        }
        .listStyle(.plain)
        .coordinateSpace(name: "libraryScroll")
        .onPreferenceChange(LibrarySearchTopPreference.self) { top in
            if let top {
                hasMeasuredSearch = true
                searchTransitionProgress = LibrarySearchTransition.progress(for: top)
            } else if hasMeasuredSearch {
                searchTransitionProgress = 1
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(.systemBackground))
        .refreshable { await onRefresh() }
        .navigationTitle("Bkmk")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(LibraryAppearance.blue, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showingCreate = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("New note")
            }
            ToolbarItem(placement: .principal) {
                ZStack {
                    Text("Bkmk")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .opacity(1 - searchTransitionProgress)
                    LibrarySearchField(title: "Search notes", tags: availableTags, searchText: $searchText, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag, isCompact: true)
                        .opacity(searchTransitionProgress)
                        .allowsHitTesting(searchTransitionProgress >= 0.5)
                        .accessibilityHidden(searchTransitionProgress < 0.5)
                }
            }
        }
        .fullScreenCover(isPresented: $showingCreate) {
            NoteEditorView(onSave: onCreate)
        }
        .alert("Delete note?", isPresented: Binding(
            get: { noteToDelete != nil },
            set: { if !$0 { noteToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let note = noteToDelete else { return }
                noteToDelete = nil
                Task { await onDelete(note) }
            }
            Button("Cancel", role: .cancel) { noteToDelete = nil }
        } message: {
            Text("This note will be deleted and synced when online.")
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
            VStack(alignment: .leading, spacing: 16) {
                MarkdownReader(markdown: note.content)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Edit") { isEditing = true }
            }
        }
        .fullScreenCover(isPresented: $isEditing) {
            NoteEditorView(note: note, onSave: saveContent)
        }
    }
}

private struct NoteEditorView: View {
    let onSave: (String) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var content: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(note: Note? = nil, onSave: @escaping (String) async -> Bool) {
        self.isNew = note == nil
        self.onSave = onSave
        _content = State(initialValue: note?.content ?? "")
    }

    private let isNew: Bool

    var body: some View {
        NavigationStack {
            MarkdownTextEditor(text: $content)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle(isNew ? "New Note" : "Edit Note")
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

/// Keeps Markdown source editable while giving the same lightweight cues as the web editor.
private struct MarkdownTextEditor: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.font = .monospacedSystemFont(ofSize: 16, weight: .regular)
        view.textColor = .label
        view.backgroundColor = .systemBackground
        view.autocorrectionType = .yes
        view.smartDashesType = .no
        view.smartQuotesType = .no
        view.textContainerInset = UIEdgeInsets(top: 20, left: 16, bottom: 20, right: 16)
        view.keyboardDismissMode = .interactive
        view.text = text
        context.coordinator.decorate(view)
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        guard view.text != text else { return }
        view.text = text
        context.coordinator.decorate(view)
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: MarkdownTextEditor
        private let font = UIFont.monospacedSystemFont(ofSize: 16, weight: .regular)

        init(_ parent: MarkdownTextEditor) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
            decorate(textView)
        }

        func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText replacement: String) -> Bool {
            guard replacement == "\n", range.length == 0 else { return true }
            let source = textView.text as NSString
            let line = source.lineRange(for: NSRange(location: range.location, length: 0))
            let prefix = source.substring(with: NSRange(location: line.location, length: range.location - line.location))
            let pattern = #"^(\s*)([-*+]\s+|\d+[.)]\s+)(.*)$"#
            guard let match = prefix.range(of: pattern, options: .regularExpression), match.lowerBound == prefix.startIndex else { return true }
            let parts = prefix.matchGroups(pattern: pattern)
            guard parts.count == 4 else { return true }
            let indent = parts[1]
            let marker = parts[2]
            let item = parts[3]
            let editRange: NSRange
            let insertion: String
            if item.trimmingCharacters(in: .whitespaces).isEmpty {
                editRange = NSRange(location: line.location, length: range.location - line.location)
                insertion = "\n" + indent
            } else {
                editRange = range
                let nextMarker: String
                if let number = Int(marker.prefix(while: { $0.isNumber })) {
                    nextMarker = "\(number + 1). "
                } else {
                    nextMarker = marker
                }
                insertion = "\n" + indent + nextMarker
            }
            textView.textStorage.replaceCharacters(in: editRange, with: insertion)
            textView.selectedRange = NSRange(location: editRange.location + (insertion as NSString).length, length: 0)
            textViewDidChange(textView)
            return false
        }

        func decorate(_ textView: UITextView) {
            let selection = textView.selectedRange
            let source = textView.text ?? ""
            let fullRange = NSRange(location: 0, length: (source as NSString).length)
            let storage = textView.textStorage
            storage.beginEditing()
            storage.setAttributes([.font: font, .foregroundColor: UIColor.label], range: fullRange)

            func mark(_ pattern: String, color: UIColor? = nil, weight: UIFont.Weight? = nil) {
                guard let regex = try? NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines]) else { return }
                for match in regex.matches(in: source, range: fullRange) {
                    var attributes: [NSAttributedString.Key: Any] = [:]
                    if let color { attributes[.foregroundColor] = color }
                    if let weight { attributes[.font] = UIFont.monospacedSystemFont(ofSize: 16, weight: weight) }
                    storage.addAttributes(attributes, range: match.range)
                }
            }

            mark(#"^\s{0,3}#{1,3}\s+.*$"#, weight: .bold)
            mark(#"(\*\*|__)(?=\S).+?\1"#, weight: .bold)
            mark(#"(\*|_)(?=\S).+?\1"#, color: .secondaryLabel)
            mark(#"^\s*([-*+]|\d+[.)])\s+"#, color: .secondaryLabel)
            mark(#"^\s{0,3}(#{1,3}\s+|>\s?)"#, color: .secondaryLabel)
            mark(#"`[^`\n]+`"#, color: .systemIndigo)
            storage.endEditing()
            textView.selectedRange = selection
            textView.typingAttributes = [.font: font, .foregroundColor: UIColor.label]
        }
    }
}

private extension String {
    func matchGroups(pattern: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: self, range: NSRange(location: 0, length: (self as NSString).length)) else { return [] }
        let string = self as NSString
        return (0..<match.numberOfRanges).map { match.range(at: $0).location == NSNotFound ? "" : string.substring(with: match.range(at: $0)) }
    }
}

// MARK: - Simplified Row
struct NoteRow: View {
    let note: Note

    private var plainText: String { markdownPlainText(note.content) }
    private var lines: [String] {
        plainText.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(noteTitle(lines.first ?? "Untitled note"))
                .font(.system(.headline, design: .serif))
                .lineLimit(2)
            
            if lines.count > 1 {
                Text(lines.dropFirst().joined(separator: " "))
                    .font(.system(.subheadline, design: .serif))
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
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

func markdownPlainText(_ markdown: String) -> String {
    var text = markdown
    let replacements: [(String, String)] = [
        (#"(?s)```.*?```"#, ""),
        (#"!\[([^\]]*)\]\([^)]*\)"#, "$1"),
        (#"\[([^\]]+)\]\([^)]*\)"#, "$1"),
        (#"`([^`]+)`"#, "$1"),
        (#"(?m)^\s{0,3}#{1,6}\s+"#, ""),
        (#"(?m)^\s{0,3}>\s?"#, ""),
        (#"(?m)^\s*([-*+]|\d+[.)])\s+"#, ""),
        (#"(?m)^\s*\[[ xX]\]\s*"#, ""),
        (#"(?m)^\s*([-*_]\s*){3,}$"#, ""),
        (#"(?m)^\s*[=-]{2,}\s*$"#, ""),
        (#"(\*\*\*|___|\*\*|__|\*|_|~~)(?=\S)(.+?\S)\1"#, "$2"),
        (#"<[^>]+>"#, "")
    ]
    for (pattern, replacement) in replacements {
        text = text.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
    }
    return text.trimmingCharacters(in: .whitespacesAndNewlines)
}
