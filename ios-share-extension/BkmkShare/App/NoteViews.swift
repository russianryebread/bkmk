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
    let onCreate: (String) async -> String?
    let onEdit: (String, String) async -> Bool
    @State private var searchText = ""
    @State private var favoritesOnly = false
    @State private var selectedTag: String?
    @State private var noteToDelete: Note?
    @State private var showingCreate = false
    @State private var draftNoteID: String?
    @State private var searchTop: CGFloat?
    @State private var viewportTop: CGFloat?
    @State private var hasMeasuredSearch = false

    private var searchTransitionProgress: CGFloat {
        guard let searchTop, let viewportTop else { return hasMeasuredSearch ? 1 : 0 }
        return LibrarySearchTransition.progress(searchTop: searchTop, viewportTop: viewportTop)
    }

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
            LibrarySearchHeader(title: "Search notes", tags: availableTags, transitionProgress: searchTransitionProgress, searchText: $searchText, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag)
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
                    NavigationLink(destination: NoteView(note: note, onEdit: { content in await onEdit(note.id, content) })) {
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
        .modifier(LibraryRefreshStyle(onRefresh: onRefresh))
        .onPreferenceChange(LibrarySearchTopPreference.self) { top in
            if top != nil { hasMeasuredSearch = true }
            searchTop = top
        }
        .onPreferenceChange(LibraryViewportTopPreference.self) { top in
            viewportTop = top
        }
        .navigationTitle("Notes")
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            LibraryNavigationHeader(title: "Notes", searchTitle: "Search notes", tags: availableTags, transitionProgress: searchTransitionProgress, searchText: $searchText, favoritesOnly: $favoritesOnly, selectedTag: $selectedTag) {
                draftNoteID = nil
                showingCreate = true
            }
        }
        .fullScreenCover(isPresented: $showingCreate) {
            NoteEditorView { content in
                if let draftNoteID {
                    return await onEdit(draftNoteID, content)
                }
                guard let id = await onCreate(content) else { return false }
                draftNoteID = id
                return true
            }
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
                MarkdownReader(markdown: normalizedNoteTitleContent(note.content))
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
    @Environment(\.scenePhase) private var scenePhase
    @State private var content: String
    @State private var isSaving = false
    @State private var isFinishing = false
    @State private var errorMessage: String?
    @State private var lastSavedContent: String?
    @State private var saveTask: Task<Void, Never>?

    init(note: Note? = nil, onSave: @escaping (String) async -> Bool) {
        self.isNew = note == nil
        self.onSave = onSave
        _content = State(initialValue: note.map { normalizedNoteTitleContent($0.content) } ?? "# ")
        _lastSavedContent = State(initialValue: note?.content)
    }

    private let isNew: Bool

    private var hasMeaningfulContent: Bool {
        let body = content.hasPrefix("# ") ? String(content.dropFirst(2)) : content
        return !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func scheduleSave() {
        saveTask?.cancel()
        guard !isNew || lastSavedContent != nil || hasMeaningfulContent else { return }
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 700_000_000)
            guard !Task.isCancelled else { return }
            _ = await saveIfNeeded()
        }
    }

    private func saveIfNeeded() async -> Bool {
        guard !isSaving else { return false }
        if isNew && lastSavedContent == nil && !hasMeaningfulContent { return true }
        guard content != lastSavedContent else { return true }
        isSaving = true
        let snapshot = content
        let saved = await onSave(snapshot)
        if saved { lastSavedContent = snapshot }
        isSaving = false
        if saved && content != snapshot { scheduleSave() }
        return saved
    }

    private func finishEditing() async {
        guard !isFinishing else { return }
        isFinishing = true
        defer { isFinishing = false }
        saveTask?.cancel()
        while isSaving {
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        while content != lastSavedContent {
            if isNew && lastSavedContent == nil && !hasMeaningfulContent { break }
            guard await saveIfNeeded() else {
                errorMessage = "Could not save this note on this device. Please try again."
                return
            }
        }
        dismiss()
    }

    var body: some View {
        NavigationStack {
            MarkdownTextEditor(text: $content, autoFocus: isNew)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle(isNew ? "" : "Edit Note")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { Task { await finishEditing() } }
                            .disabled(isFinishing)
                    }
                }
                .onChange(of: content) { _ in scheduleSave() }
                .onAppear {
                    if content != lastSavedContent { scheduleSave() }
                }
                .onChange(of: scenePhase) { phase in
                    if phase != .active {
                        saveTask?.cancel()
                        Task { _ = await saveIfNeeded() }
                    }
                }
                .interactiveDismissDisabled()
                .alert("Save failed", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                    Button("OK", role: .cancel) { errorMessage = nil }
                } message: { Text(errorMessage ?? "") }
        }
    }
}

private func normalizedNoteTitleContent(_ content: String) -> String {
    let firstLine = content.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
    guard firstLine.hasPrefix("# ") else { return content }
    let title = String(firstLine.dropFirst(2))
    if title.count > 128 || (title.isEmpty && content.contains("\n")) {
        return String(content.dropFirst(2))
    }
    return content
}

/// Keeps Markdown source editable while giving the same lightweight cues as the web editor.
private final class FocusableNoteTextView: UITextView {
    var focusOnAttach = false

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard focusOnAttach, window != nil else { return }
        focusOnAttach = false
        DispatchQueue.main.async { [weak self] in self?.becomeFirstResponder() }
    }
}

private struct MarkdownTextEditor: UIViewRepresentable {
    @Binding var text: String
    let autoFocus: Bool

    func makeUIView(context: Context) -> UITextView {
        let view = FocusableNoteTextView()
        view.focusOnAttach = autoFocus
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
        view.selectedRange = NSRange(location: (text as NSString).length, length: 0)
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
            normalizeTitle(in: textView)
            parent.text = textView.text
            decorate(textView)
        }

        private func normalizeTitle(in textView: UITextView) {
            let source = textView.text ?? ""
            let firstLine = source.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
            guard firstLine.hasPrefix("# ") else { return }
            let title = String(firstLine.dropFirst(2))
            guard title.count > 128 || (title.isEmpty && source.contains("\n")) else { return }
            let selection = textView.selectedRange
            textView.textStorage.replaceCharacters(in: NSRange(location: 0, length: 2), with: "")
            let start = max(0, selection.location - 2)
            let end = max(start, selection.location + selection.length - 2)
            textView.selectedRange = NSRange(location: start, length: end - start)
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

    private var heading: String? {
        let firstLine = note.content.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        guard firstLine.hasPrefix("# ") else { return nil }
        let title = String(firstLine.dropFirst(2))
        guard !title.isEmpty, title.count <= 128 else { return nil }
        return markdownPlainText(title)
    }

    private var plainText: String { markdownPlainText(note.content) }
    private var lines: [String] {
        plainText.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let heading {
                Text(noteTitle(heading))
                    .font(.system(.headline, design: .serif))
                    .lineLimit(2)

                if lines.count > 1 {
                    Text(lines.dropFirst().joined(separator: " "))
                        .font(.system(.subheadline, design: .serif))
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            } else {
                Text(plainText.isEmpty ? "Empty note" : plainText)
                    .font(.system(.subheadline, design: .serif))
                    .foregroundColor(.secondary)
                    .lineLimit(3)
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
