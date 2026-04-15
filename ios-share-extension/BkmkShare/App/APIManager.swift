import Foundation

enum APIEndpoint: String {
    case bookmarks = "bookmarks"
    case notes = "notes/markdown"
}

@MainActor
class APIManager: ObservableObject {
    static let shared = APIManager()
    
    @Published var bookmarks: [Bookmark] = []
    @Published var notes: [Note] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = AppConfig.apiBaseURL
    
    // File URLs for persistence
    private let bookmarksURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("bookmarks_cache.json")
    private let notesURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("notes_cache.json")
    
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
    
    // MARK: - Bookmark Methods
    func fetchBookmarks(token: String, page: Int = 1, limit: Int = 50) async {
        // Read-through: UI already has cached data from init()
        if let result: BookmarksResponse = await fetchData(endpoint: .bookmarks, token: token, params: ["page": "\(page)", "limit": "\(limit)"]) {
            self.bookmarks = result.bookmarks
            saveToDisk() // Update cache with fresh data
        }
    }
    
    func deleteBookmark(id: String, token: String) async -> Bool {
        let success = await performAction(endpoint: .bookmarks, id: id, method: "DELETE", token: token)
        if success {
            bookmarks.removeAll { $0.id == id }
            saveToDisk()
        }
        return success
    }
    
    func favoriteBookmark(id: String, token: String) async -> Bool {
        guard let index = bookmarks.firstIndex(where: { $0.id == id }) else { return false }
        let currentStatus = bookmarks[index].isFavorite ?? false
        let body = ["is_favorite": !currentStatus]
        
        let success = await performAction(endpoint: .bookmarks, id: id, method: "PUT", token: token, body: body)
        if success {
            // Optimistic update or refresh
            bookmarks[index].isFavorite = !currentStatus
            saveToDisk()
        }
        return success
    }
    
    // MARK: - Note Methods
    func fetchNotes(token: String, page: Int = 1, limit: Int = 50) async {
        if let result: NotesResponse = await fetchData(endpoint: .notes, token: token, params: [:]) {
            self.notes = result.notes
            saveToDisk()
        }
    }
    
    func deleteNote(id: String, token: String) async -> Bool {
        let success = await performAction(endpoint: .notes, id: id, method: "DELETE", token: token)
        if success {
            notes.removeAll { $0.id == id }
            saveToDisk()
        }
        return success
    }
    
    func favoriteNote(id: String, token: String) async -> Bool {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return false }
        let currentStatus = notes[index].isFavorite ?? false
        let body = ["is_favorite": !currentStatus]
        
        let success = await performAction(endpoint: .notes, id: id, method: "PUT", token: token, body: body)
        if success {
            notes[index].isFavorite = !currentStatus
            saveToDisk()
        }
        return success
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
