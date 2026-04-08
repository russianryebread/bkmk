import Foundation

// MARK: - Bookmark Model
struct Bookmark: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let url: String
    let description: String?
    let cleanedMarkdown: String?
    let originalHtml: String?
    let readingTimeMinutes: Int?
    let savedAt: String?
    let lastAccessedAt: String?
    let isFavorite: Bool?
    let isRead: Bool?
    let readAt: String?
    let sourceDomain: String?
    let wordCount: Int?
    let thumbnailImagePath: String?
    let tags: [String]?
    let tagIds: [String]?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, url, description
        case cleanedMarkdown = "cleaned_markdown"
        case originalHtml = "original_html"
        case readingTimeMinutes = "reading_time_minutes"
        case savedAt = "saved_at"
        case lastAccessedAt = "last_accessed_at"
        case isFavorite = "is_favorite"
        case isRead = "is_read"
        case readAt = "read_at"
        case sourceDomain = "source_domain"
        case wordCount = "word_count"
        case thumbnailImagePath = "thumbnail_image_path"
        case tags, tagIds
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - API Response Models
struct BookmarksResponse: Codable {
    let bookmarks: [Bookmark]
    let pagination: Pagination?
}

struct BookmarkResponse: Codable {
    let success: Bool?
    let bookmark: Bookmark?
}

struct Pagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
}

struct User: Codable {
    let id: String
    let email: String
    let role: String?
}

struct AuthResponse: Codable {
    let user: User
    let token: String
}

struct ErrorResponse: Codable {
    let statusCode: Int
    let message: String
}

struct LoginResponse: Codable {
    let user: User
    let token: String?
}

struct LoginResponseNoToken: Codable {
    let user: User
}
