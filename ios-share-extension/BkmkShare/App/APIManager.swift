import Foundation

enum APIEndpoint: String {
    case bookmarks = "bookmarks"
    case notes = "notes"
}

private struct PendingNativeEdit: Codable {
    let id: String
    let kind: String
    var operation: String?
    var content: String?
    var title: String?
    var url: String?
    var isFavorite: Bool?
}

@MainActor
class APIManager: ObservableObject {
    static let shared = APIManager()
    
    @Published var bookmarks: [Bookmark] = []
    @Published var notes: [Note] = []
    @Published var pendingSharedURLs: [PendingSharedURL] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = AppConfig.apiBaseURL
    
    // File URLs for persistence
    private let bookmarksURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("bookmarks_cache.json")
    private let notesURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("notes_cache.json")
    private let pendingEditsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("pending_edits.json")
    private var pendingEdits: [PendingNativeEdit] = []
    private var isFlushingEdits = false
    
    init() {
        loadFromDisk()
    }
    
    // MARK: - Persistence Logic
    private func loadFromDisk() {
        if let data = try? Data(contentsOf: bookmarksURL),
           let decoded = try? JSONDecoder().decode([Bookmark].self, from: data) {
            self.bookmarks = decoded
        }
        
        if let data = try? Data(contentsOf: notesURL),
           let decoded = try? JSONDecoder().decode([Note].self, from: data) {
            self.notes = decoded
        }

        if let data = try? Data(contentsOf: pendingEditsURL),
           let decoded = try? JSONDecoder().decode([PendingNativeEdit].self, from: data) {
            pendingEdits = decoded
        }
        pendingSharedURLs = SharedURLQueue.all()
    }
    
    private func saveToDisk() {
        let encoder = JSONEncoder()
        if let bookmarkData = try? encoder.encode(bookmarks) {
            try? bookmarkData.write(to: bookmarksURL, options: .atomic)
        }
        if let noteData = try? encoder.encode(notes) {
            try? noteData.write(to: notesURL, options: .atomic)
        }
    }

    private func savePendingEdits() {
        guard let data = try? JSONEncoder().encode(pendingEdits) else { return }
        try? data.write(to: pendingEditsURL, options: .atomic)
    }

    private func queueEdit(_ edit: PendingNativeEdit) {
        let existingIndex = pendingEdits.firstIndex { $0.id == edit.id && $0.kind == edit.kind }
        if edit.operation == "delete" {
            pendingEdits.removeAll { $0.id == edit.id && $0.kind == edit.kind }
            pendingEdits.append(edit)
        } else if let existingIndex, pendingEdits[existingIndex].operation == "delete" {
            // Keep a queued deletion authoritative; callers cannot edit a row
            // that is no longer present in the local cache.
        } else if let existingIndex {
            let existing = pendingEdits[existingIndex]
            pendingEdits[existingIndex] = PendingNativeEdit(
                id: edit.id,
                kind: edit.kind,
                operation: "update",
                content: edit.content ?? existing.content,
                title: edit.title ?? existing.title,
                url: edit.url ?? existing.url,
                isFavorite: edit.isFavorite ?? existing.isFavorite
            )
        } else {
            pendingEdits.append(edit)
        }
        savePendingEdits()
    }

    private func flushPendingEdits(token: String) async {
        guard !isFlushingEdits else { return }
        isFlushingEdits = true
        defer { isFlushingEdits = false }
        for edit in pendingEdits {
            let endpoint: APIEndpoint
            var body: [String: Any]?
            var method = "PUT"
            switch edit.kind {
            case "bookmark":
                endpoint = .bookmarks
                if edit.operation == "delete" { method = "DELETE" }
                else {
                    var values: [String: Any] = [:]
                    if let title = edit.title { values["title"] = title }
                    if let url = edit.url { values["url"] = url }
                    if let isFavorite = edit.isFavorite { values["isFavorite"] = isFavorite }
                    body = values
                }
            case "note":
                endpoint = .notes
                if edit.operation == "delete" { method = "DELETE" }
                else {
                    var values: [String: Any] = [:]
                    if let content = edit.content { values["content"] = content }
                    if let isFavorite = edit.isFavorite { values["isFavorite"] = isFavorite }
                    body = values
                }
            default:
                continue
            }
            guard await performAction(endpoint: endpoint, id: edit.id, method: method, token: token, body: body) else { break }
            pendingEdits.removeAll { $0.id == edit.id && $0.kind == edit.kind }
            savePendingEdits()
        }
    }

    private func applyPendingEditsToCache() {
        for edit in pendingEdits {
            if edit.kind == "bookmark", let index = bookmarks.firstIndex(where: { $0.id == edit.id }) {
                if edit.operation == "delete" { bookmarks.remove(at: index) }
                else {
                    if let title = edit.title { bookmarks[index].title = title }
                    if let url = edit.url { bookmarks[index].url = url }
                    if let isFavorite = edit.isFavorite { bookmarks[index].isFavorite = isFavorite }
                }
            } else if edit.kind == "note", let index = notes.firstIndex(where: { $0.id == edit.id }) {
                if edit.operation == "delete" { notes.remove(at: index) }
                else {
                    if let content = edit.content { notes[index].content = content }
                    if let isFavorite = edit.isFavorite { notes[index].isFavorite = isFavorite }
                }
            }
        }
    }
    
    // MARK: - Bookmark Methods
    func fetchBookmarks(token: String, page: Int = 1, limit: Int = 50) async {
        await flushSharedURLs(token: token)
        await flushPendingEdits(token: token)
        guard let allBookmarks = await fetchAllBookmarks(token: token, limit: limit) else { return }
        bookmarks = allBookmarks
        applyPendingEditsToCache()
        saveToDisk()
    }

    func refreshPendingSharedURLs() {
        pendingSharedURLs = SharedURLQueue.all()
    }

    private func flushSharedURLs(token: String) async {
        refreshPendingSharedURLs()
        for item in pendingSharedURLs {
            guard let url = URL(string: "\(baseURL)/scrape") else { break }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["url": item.url])
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else { break }
                if (200...299).contains(httpResponse.statusCode) || httpResponse.statusCode == 409 {
                    SharedURLQueue.remove(id: item.id)
                    refreshPendingSharedURLs()
                    continue
                }
                if httpResponse.statusCode == 401 { errorMessage = "Session expired" }
                else { errorMessage = "Could not sync a shared URL (\(httpResponse.statusCode))" }
                break
            } catch {
                // The queued URL remains visible and will be retried next time
                // the app becomes active or the bookmarks list is refreshed.
                break
            }
        }
    }

    private func fetchAllBookmarks(token: String, limit: Int) async -> [Bookmark]? {
        var all: [Bookmark] = []
        var page = 1
        while true {
            guard let result: BookmarksResponse = await fetchData(endpoint: .bookmarks, token: token,
                                                                   params: ["page": "\(page)", "limit": "\(limit)"]) else { return nil }
            all.append(contentsOf: result.bookmarks)
            let totalPages = result.pagination?.totalPages
            if let totalPages, page >= totalPages { break }
            if result.bookmarks.count < limit { break }
            page += 1
        }
        return all
    }
    
    func deleteBookmark(id: String, token: String) async -> Bool {
        bookmarks.removeAll { $0.id == id }
        queueEdit(PendingNativeEdit(id: id, kind: "bookmark", operation: "delete", content: nil, title: nil, url: nil, isFavorite: nil))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }
    
    func favoriteBookmark(id: String, token: String) async -> Bool {
        guard let index = bookmarks.firstIndex(where: { $0.id == id }) else { return false }
        let currentStatus = bookmarks[index].isFavorite ?? false
        let newStatus = !currentStatus
        bookmarks[index].isFavorite = newStatus
        queueEdit(PendingNativeEdit(id: id, kind: "bookmark", operation: "update", content: nil, title: nil, url: nil, isFavorite: newStatus))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }

    func updateBookmark(id: String, title: String, url: String, token: String) async -> Bool {
        guard let index = bookmarks.firstIndex(where: { $0.id == id }) else { return false }
        bookmarks[index].title = title
        bookmarks[index].url = url
        queueEdit(PendingNativeEdit(id: id, kind: "bookmark", operation: "edit", content: nil, title: title, url: url, isFavorite: nil))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }
    
    // MARK: - Note Methods
    func fetchNotes(token: String, page: Int = 1, limit: Int = 50) async {
        await flushPendingEdits(token: token)
        guard let allNotes = await fetchAllNotes(token: token, limit: limit) else { return }
        notes = allNotes
        applyPendingEditsToCache()
        saveToDisk()
    }

    private func fetchAllNotes(token: String, limit: Int) async -> [Note]? {
        var all: [Note] = []
        var page = 1
        while true {
            guard let result: NotesResponse = await fetchData(endpoint: .notes, token: token,
                                                               params: ["page": "\(page)", "limit": "\(limit)"]) else { return nil }
            all.append(contentsOf: result.notes)
            let totalPages = result.pagination?.totalPages
            if let totalPages, page >= totalPages { break }
            if result.notes.count < limit { break }
            page += 1
        }
        return all
    }
    
    func deleteNote(id: String, token: String) async -> Bool {
        notes.removeAll { $0.id == id }
        queueEdit(PendingNativeEdit(id: id, kind: "note", operation: "delete", content: nil, title: nil, url: nil, isFavorite: nil))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }
    
    func favoriteNote(id: String, token: String) async -> Bool {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return false }
        let currentStatus = notes[index].isFavorite ?? false
        let newStatus = !currentStatus
        notes[index].isFavorite = newStatus
        queueEdit(PendingNativeEdit(id: id, kind: "note", operation: "update", content: nil, title: nil, url: nil, isFavorite: newStatus))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }

    func updateNote(id: String, content: String, token: String) async -> Bool {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return false }
        notes[index].content = content
        queueEdit(PendingNativeEdit(id: id, kind: "note", operation: "edit", content: content, title: nil, url: nil, isFavorite: nil))
        saveToDisk()
        await flushPendingEdits(token: token)
        return true
    }

    // MARK: - Private Core Logic (Unchanged from original, but ensures persistence is called above)
    private func fetchData<T: Decodable>(endpoint: APIEndpoint, token: String, params: [String: String]) async -> T? {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        var components = URLComponents(string: "\(baseURL)/\(endpoint.rawValue)")
        components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        
        guard let url = components?.url else {
            errorMessage = "Invalid URL"
            return nil
        }
        
        let request = createRequest(url: url, method: "GET", token: token)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            try validateResponse(response)
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            errorMessage = error.localizedDescription
            print(error)
            return nil
        }
    }

    private func performAction(endpoint: APIEndpoint, id: String? = nil, method: String, token: String, body: [String: Any]? = nil) async -> Bool {
        let path = [endpoint.rawValue, id].compactMap { $0 }.joined(separator: "/")
        guard let url = URL(string: "\(baseURL)/\(path)") else { return false }
        
        var request = createRequest(url: url, method: method, token: token)
        
        if let body = body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            try validateResponse(response)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func createRequest(url: URL, method: String, token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        if let httpResponse = response as? HTTPURLResponse {
            if httpResponse.statusCode == 401 {
                errorMessage = "Session expired"
                throw NSError(domain: "Auth", code: 401)
            }
            if !(200...299).contains(httpResponse.statusCode) {
                throw NSError(domain: "Server", code: httpResponse.statusCode)
            }
        }
    }
}
