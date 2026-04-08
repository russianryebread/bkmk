import Foundation

@MainActor
class APIManager: ObservableObject {
    static let shared = APIManager()
    
    @Published var bookmarks: [Bookmark] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = AppConfig.apiBaseURL
    
    func fetchBookmarks(token: String, page: Int = 1, limit: Int = 50) async {
        isLoading = true
        errorMessage = nil
        
        guard let url = URL(string: "\(baseURL)/bookmarks?page=\(page)&limit=\(limit)") else {
            errorMessage = "Invalid URL"
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 401 {
                    errorMessage = "Session expired"
                    isLoading = false
                    return
                }
            }
            
            let decoder = JSONDecoder()
            let result = try decoder.decode(BookmarksResponse.self, from: data)
            bookmarks = result.bookmarks
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func deleteBookmark(id: String, token: String) async -> Bool {
        guard let url = URL(string: "\(baseURL)/bookmarks/\(id)") else {
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                bookmarks.removeAll { $0.id == id }
                return true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }
    
    func toggleFavorite(id: String, token: String) async -> Bool {
        guard let bookmark = bookmarks.first(where: { $0.id == id }),
              let url = URL(string: "\(baseURL)/bookmarks/\(id)") else {
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "is_favorite": !(bookmark.isFavorite ?? false)
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                await fetchBookmarks(token: token)
                return true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }
}
