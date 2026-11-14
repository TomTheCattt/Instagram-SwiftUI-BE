# TÀI LIỆU CHI TIẾT DATA MODEL & HƯỚNG DẪN DECODE (DÀNH CHO FRONTEND / iOS SWIFT)

> **Dành cho:** Frontend Team (iOS SwiftUI / React Web)  
> **Backend Version:** 2.0 (Neon PostgreSQL + Drizzle ORM)  
> **Quy ước JSON API:** Toàn bộ response trả về dạng **`camelCase`**. Kiểu ngày tháng là ISO 8601 String (`"2026-11-13T10:30:00.000Z"`).

---

## 1. CẤU TRÚC PHẢN HỒI CHUẨN CỦA API (GENERIC API WRAPPER)

Tất cả các API đều bọc dữ liệu trong cấu trúc chuẩn:

```swift
// Swift Generic Response
struct ApiResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
    let message: String?
}

// 1. Phân trang dạng Cursor (Feed, Comments, Messages)
struct CursorPaginatedData<T: Codable>: Codable {
    let items: [T]
    let nextCursor: String?
    let hasMore: Bool
}

// 2. Phân trang dạng Page/Offset (Followers, Following, Search)
struct OffsetPaginatedData<T: Codable>: Codable {
    let items: [T]
    let page: Int
    let perPage: Int
    let total: Int
    let hasMore: Bool
}
```

---

## 2. DANH SÁCH ENUMS HỆ THỐNG (SWIFT ENUMS)

```swift
// Định dạng thiết bị
enum DevicePlatform: String, Codable {
    case ios = "IOS"
    case android = "ANDROID"
    case web = "WEB"
}

// Loại Media
enum MediaType: String, Codable {
    case image = "IMAGE"
    case video = "VIDEO"
    case carousel = "CAROUSEL"
    case audio = "AUDIO"
}

// Đối tượng hiển thị bài viết
enum PostAudience: String, Codable {
    case publicAudience = "PUBLIC"
    case followers = "FOLLOWERS"
    case closeFriends = "CLOSE_FRIENDS"
}

// Trạng thái Follow
enum FollowStatus: String, Codable {
    case pending = "PENDING"
    case accepted = "ACCEPTED"
    case blocked = "BLOCKED"
}

// Loại nội dung comment / like
enum CommentableType: String, Codable {
    case post = "POST"
    case reel = "REEL"
    case story = "STORY"
}

enum LikeableType: String, Codable {
    case post = "POST"
    case reel = "REEL"
    case comment = "COMMENT"
    case story = "STORY"
}

// Loại tin nhắn Direct Message
enum MessageContentType: String, Codable {
    case text = "TEXT"
    case image = "IMAGE"
    case video = "VIDEO"
    case audio = "AUDIO"
    case file = "FILE"
    case postShare = "POST_SHARE"
    case reelShare = "REEL_SHARE"
    case storyShare = "STORY_SHARE"
    case profileShare = "PROFILE_SHARE"
    case location = "LOCATION"
    case contact = "CONTACT"
    case voice = "VOICE"
    case reply = "REPLY"
    case system = "SYSTEM"
}

enum MessageStatus: String, Codable {
    case sending = "SENDING"
    case sent = "SENT"
    case delivered = "DELIVERED"
    case read = "READ"
    case failed = "FAILED"
}

// Loại thông báo
enum NotificationType: String, Codable {
    case like = "LIKE"
    case comment = "COMMENT"
    case follow = "FOLLOW"
    case followRequest = "FOLLOW_REQUEST"
    case followAccept = "FOLLOW_ACCEPT"
    case mention = "MENTION"
    case taggedInPost = "TAGGED_IN_POST"
    case taggedInComment = "TAGGED_IN_COMMENT"
    case taggedInStory = "TAGGED_IN_STORY"
    case storyMention = "STORY_MENTION"
    case storyReply = "STORY_REPLY"
    case reelLike = "REEL_LIKE"
    case reelComment = "REEL_COMMENT"
    case liveVideo = "LIVE_VIDEO"
    case liveJoin = "LIVE_JOIN"
    case dmMessage = "DM_MESSAGE"
    case dmReaction = "DM_REACTION"
}
```

---

## 3. CHI TIẾT MAPPING TỪNG BẢNG DỮ LIỆU

### 3.1. Bảng `users` (Thông tin người dùng)
*Mô tả: Lưu trữ hồ sơ, tài khoản và các bộ đếm số lượng.*

| Tên DB (`snake_case`) | Tên JSON API (`camelCase`) | Kiểu Swift | Nullable? | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` (UUID) | Không | ID định danh duy nhất của người dùng |
| `username` | `username` | `String` | Không | Username (@username), từ 1-30 ký tự |
| `email` | `email` | `String` | Không | Địa chỉ email đăng nhập |
| `phone` | `phone` | `String?` | **Có** | Số điện thoại liên kết |
| `name` | `name` | `String?` | **Có** | Tên đầy đủ (chuẩn Better Auth) |
| `full_name` | `fullName` | `String?` | **Có** | Tên hiển thị (alias của `name`) |
| `bio` | `bio` | `String?` | **Có** | Tiểu sử cá nhân (tối đa 150 ký tự) |
| `website` | `website` | `String?` | **Có** | Đường dẫn link bio website |
| `avatar_url` | `avatarUrl` | `String?` | **Có** | Link ảnh đại diện kích thước gốc |
| `avatar_thumb_url` | `avatarThumbUrl` | `String?` | **Có** | Link thumbnail avatar (nhỏ) |
| `is_verified` | `isVerified` | `Bool` | Không | Tích xanh xác minh (mặc định: `false`) |
| `is_private` | `isPrivate` | `Bool` | Không | Tài khoản riêng tư (mặc định: `false`) |
| `is_business` | `isBusiness` | `Bool` | Không | Tài khoản doanh nghiệp/creator |
| `business_category`| `businessCategory` | `String?` | **Có** | Danh mục ngành nghề |
| `posts_count` | `postsCount` | `Int` | Không | Tổng số bài viết công khai |
| `followers_count` | `followersCount` | `Int` | Không | Tổng số người theo dõi |
| `following_count` | `followingCount` | `Int` | Không | Tổng số người đang theo dõi |
| `reels_count` | `reelsCount` | `Int` | Không | Tổng số video Reels |
| `settings` | `settings` | `UserSettings` | Không | Cấu hình riêng tư, push notification |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời điểm tạo tài khoản |

```swift
// Swift Model
struct User: Codable, Identifiable {
    let id: String
    let username: String
    let email: String
    let phone: String?
    let name: String?
    let fullName: String?
    let bio: String?
    let website: String?
    let avatarUrl: String?
    let avatarThumbUrl: String?
    let isVerified: Bool
    let isPrivate: Bool
    let isBusiness: Bool
    let businessCategory: String?
    let postsCount: Int
    let followersCount: Int
    let followingCount: Int
    let reelsCount: Int
    let settings: UserSettings?
    let createdAt: Date?
    
    // Thuộc tính tính toán thường có trong API danh sách
    var isFollowing: Bool? // true: đang follow, false: chưa follow, null: chính mình
}

struct UserSettings: Codable {
    let language: String?
    let darkMode: Bool?
    let pushEnabled: Bool?
    let biometricEnabled: Bool?
}
```

---

### 3.2. Bảng `posts` (Bài viết) & `media_items` (Media đính kèm)
*Mô tả: Bài viết dạng ảnh đơn, video, hoặc album nhiều ảnh (Carousel).*

| Tên DB (`snake_case`) | Tên JSON API (`camelCase`) | Kiểu Swift | Nullable? | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` (UUID) | Không | ID bài post |
| `author_id` | `authorId` | `String` | Không | ID người đăng bài |
| `caption` | `caption` | `String?` | **Có** | Nội dung chú thích bài viết |
| `location_name` | `locationName` | `String?` | **Có** | Tên địa điểm check-in |
| `location_lat` | `locationLat` | `Double?` | **Có** | Vĩ độ địa điểm |
| `location_lng` | `locationLng` | `Double?` | **Có** | Kinh độ địa điểm |
| `likes_count` | `likesCount` | `Int` | Không | Số lượng lượt thả tim |
| `comments_count` | `commentsCount` | `Int` | Không | Số lượng bình luận |
| `saves_count` | `savesCount` | `Int` | Không | Số lượt lưu bài viết |
| `views_count` | `viewsCount` | `Int` | Không | Số lượt xem bài viết |
| `audience` | `audience` | `PostAudience` | Không | Đối tượng: `PUBLIC`, `FOLLOWERS`, `CLOSE_FRIENDS` |
| `close_friends_only`| `closeFriendsOnly` | `Bool` | Không | Chỉ hiển thị với bạn thân |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời gian đăng bài |
| `updated_at` | `updatedAt` | `Date` (ISO) | Không | Thời gian cập nhật |

#### Bảng `media_items` (Danh sách ảnh/video của bài viết)
| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID file media |
| `url` | `url` | `String` | Không | URL ảnh/video độ phân giải cao |
| `thumbnail_url` | `thumbnailUrl` | `String?` | **Có** | URL ảnh thumbnail xem trước |
| `type` | `type` | `MediaType` | Không | `IMAGE`, `VIDEO`, `CAROUSEL` |
| `width` | `width` | `Int?` | **Có** | Chiều rộng ảnh (pixel) |
| `height` | `height` | `Int?` | **Có** | Chiều cao ảnh (pixel) |
| `duration` | `duration` | `Double?` | **Có** | Thời lượng video (giây) |
| `sort_order` | `sortOrder` | `Int` | Không | Thứ tự hiển thị trong album carousel (0, 1, 2...) |

```swift
// Swift Model
struct Post: Codable, Identifiable {
    let id: String
    let authorId: String
    let caption: String?
    let locationName: String?
    let locationLat: Double?
    let locationLng: Double?
    let likesCount: Int
    let commentsCount: Int
    let savesCount: Int
    let viewsCount: Int
    let audience: PostAudience
    let closeFriendsOnly: Bool
    let createdAt: Date
    let updatedAt: Date
    
    // Quan hệ kèm theo từ API
    let author: UserAuthorSummary
    let mediaItems: [MediaItem]
    let isLiked: Bool? // Người dùng hiện tại đã like chưa
    let isSaved: Bool? // Người dùng hiện tại đã bookmark chưa
}

struct UserAuthorSummary: Codable, Identifiable {
    let id: String
    let username: String
    let fullName: String?
    let avatarUrl: String?
    let isVerified: Bool
    var isFollowing: Bool?
}

struct MediaItem: Codable, Identifiable {
    let id: String
    let url: String
    let thumbnailUrl: String?
    let type: MediaType
    let width: Int?
    let height: Int?
    let duration: Double?
    let sortOrder: Int
}
```

---

### 3.3. Bảng `reels` (Video ngắn) & `audio_tracks` (Âm thanh)
*Mô tả: Video ngắn dạng dọc tương tự TikTok/Instagram Reels.*

| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID video Reel |
| `author_id` | `authorId` | `String` | Không | ID người tạo Reel |
| `video_url` | `videoUrl` | `String` | Không | Link phát video HLS/MP4 |
| `thumbnail_url` | `thumbnailUrl` | `String?` | **Có** | Ảnh cover đại diện cho video |
| `caption` | `caption` | `String?` | **Có** | Mô tả video kèm hashtag |
| `duration` | `duration` | `Double` | Không | Thời lượng video (giây) |
| `audio_id` | `audioId` | `String?` | **Có** | ID bài nhạc sử dụng |
| `audio_name` | `audioName` | `String?` | **Có** | Tên bài hát/âm thanh |
| `audio_artist` | `audioArtist` | `String?` | **Có** | Tên nghệ sĩ/tác giả âm thanh |
| `audio_cover_url` | `audioCoverUrl`| `String?` | **Có** | Ảnh bìa album âm thanh |
| `is_original_audio`| `isOriginalAudio`| `Bool` | Không | Âm thanh gốc do chính người quay tạo |
| `likes_count` | `likesCount` | `Int` | Không | Số lượt like |
| `comments_count` | `commentsCount` | `Int` | Không | Số bình luận |
| `shares_count` | `sharesCount` | `Int` | Không | Số lượt share |
| `saves_count` | `savesCount` | `Int` | Không | Số lượt bookmark |
| `views_count` | `viewsCount` | `Int` | Không | Số lượt xem video |
| `allow_remix` | `allowRemix` | `Bool` | Không | Cho phép người khác remix video |
| `allow_download` | `allowDownload` | `Bool` | Không | Cho phép tải video về máy |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời gian đăng Reel |

```swift
// Swift Model
struct Reel: Codable, Identifiable {
    let id: String
    let authorId: String
    let videoUrl: String
    let thumbnailUrl: String?
    let caption: String?
    let duration: Double
    let audioId: String?
    let audioName: String?
    let audioArtist: String?
    let audioCoverUrl: String?
    let isOriginalAudio: Bool
    let likesCount: Int
    let commentsCount: Int
    let sharesCount: Int
    let savesCount: Int
    let viewsCount: Int
    let allowRemix: Bool
    let allowDownload: Bool
    let createdAt: Date
    
    // Tích hợp người tạo & trạng thái
    let author: UserAuthorSummary?
    let isLiked: Bool?
    let isSaved: Bool?
}
```

---

### 3.4. Bảng `stories` (Tin 24 giờ) & `story_views` (Lượt xem story)
*Mô tả: Nội dung tự động hết hạn sau 24h.*

| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID story |
| `author_id` | `authorId` | `String` | Không | ID người đăng story |
| `audience` | `audience` | `String` | Không | `"followers"` hoặc `"close_friends"` |
| `expires_at` | `expiresAt` | `Date` (ISO) | Không | **Thời điểm hết hạn (24h sau khi đăng)** |
| `views_count` | `viewsCount` | `Int` | Không | Số người đã xem story |
| `replies_count` | `repliesCount` | `Int` | Không | Số tin nhắn reply story |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời điểm đăng |

#### Bảng `story_items` (Từng slide ảnh/video bên trong story)
| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID slide |
| `story_id` | `storyId` | `String` | Không | Thuộc story nào |
| `media_url` | `mediaUrl` | `String` | Không | Link ảnh/video story |
| `thumbnail_url` | `thumbnailUrl` | `String?` | **Có** | Thumbnail xem trước |
| `type` | `type` | `MediaType` | Không | `IMAGE` hoặc `VIDEO` |
| `duration` | `duration` | `Double` | Không | Thời gian chạy slide (mặc định 5s cho ảnh) |
| `sort_order` | `sortOrder` | `Int` | Không | Thứ tự slide (0, 1, 2...) |
| `sticker_type` | `stickerType` | `String?` | **Có** | Loại nhãn dán: `"poll"`, `"question"`, `"link"` |
| `sticker_data` | `stickerData` | `[String: AnyCodable]?`| **Có** | Payload dữ liệu của sticker |

```swift
// Swift Model
struct Story: Codable, Identifiable {
    let id: String
    let authorId: String
    let audience: String
    let expiresAt: Date
    let viewsCount: Int
    let repliesCount: Int
    let createdAt: Date
    let author: UserAuthorSummary
    let items: [StoryItem]
    let viewed: Bool? // Đã xem toàn bộ slide chưa
}

struct StoryItem: Codable, Identifiable {
    let id: String
    let storyId: String
    let mediaUrl: String
    let thumbnailUrl: String?
    let type: MediaType
    let duration: Double
    let sortOrder: Int
    let stickerType: String?
    let createdAt: Date
}
```

---

### 3.5. Bảng `comments` (Bình luận & Trả lời)
*Mô tả: Hỗ trợ bình luận 2 tầng: Comment gốc và Reply.*

| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID comment |
| `commentable_type` | `commentableType` | `CommentableType`| Không | `"POST"` hoặc `"REEL"` |
| `commentable_id` | `commentableId` | `String` | Không | ID bài Post hoặc Reel được comment |
| `author_id` | `authorId` | `String` | Không | ID người bình luận |
| `parent_id` | `parentId` | `String?` | **Có** | `null` nếu là comment gốc; có ID nếu là Reply |
| `text` | `text` | `String` | Không | Nội dung text bình luận |
| `likes_count` | `likesCount` | `Int` | Không | Số lượt like của comment |
| `replies_count` | `repliesCount` | `Int` | Không | Số lượt trả lời cho comment này |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời gian tạo |

```swift
// Swift Model
struct Comment: Codable, Identifiable {
    let id: String
    let commentableType: CommentableType
    let commentableId: String
    let authorId: String
    let parentId: String?
    let text: String
    let likesCount: Int
    let repliesCount: Int
    let createdAt: Date
    
    let author: UserAuthorSummary
    let isLiked: Bool?
    var replies: [Comment]? // Mảng reply cấp 1 nếu được load kèm
}
```

---

### 3.6. Bảng `conversations` (Cuộc trò chuyện) & `messages` (Tin nhắn Direct Message)

#### Bảng `conversations` (Hộp thoại)
| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID cuộc trò chuyện |
| `is_group` | `isGroup` | `Bool` | Không | `false` (chat 1-1) hoặc `true` (chat nhóm) |
| `group_name` | `groupName` | `String?` | **Có** | Tên nhóm nếu là chat group |
| `group_avatar_url` | `groupAvatarUrl`| `String?` | **Có** | Ảnh đại diện nhóm |
| `last_message_text`| `lastMessageText`| `String?` | **Có** | **Xem trước nội dung tin nhắn cuối cùng** |
| `last_message_at` | `lastMessageAt` | `Date?` | **Có** | **Thời gian tin nhắn cuối (dùng để sort inbox)** |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời điểm tạo hộp thoại |
| `updated_at` | `updatedAt` | `Date` (ISO) | Không | Thời điểm hoạt động mới nhất |

#### Bảng `messages` (Tin nhắn chi tiết)
| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID tin nhắn |
| `conversation_id` | `conversationId` | `String` | Không | ID hộp thoại chứa tin nhắn |
| `sender_id` | `senderId` | `String` | Không | ID người gửi tin nhắn |
| `content_type` | `contentType` | `MessageContentType`| Không | `TEXT`, `IMAGE`, `VIDEO`, `POST_SHARE`, v.v. |
| `text_content` | `textContent` | `String?` | **Có** | Nội dung chữ của tin nhắn |
| `media_url` | `mediaUrl` | `String?` | **Có** | Link ảnh/video/audio gửi kèm |
| `media_thumbnail` | `mediaThumbnail` | `String?` | **Có** | Thumbnail của media |
| `media_duration` | `mediaDuration` | `Double?` | **Có** | Thời lượng file thoại/video (giây) |
| `reply_to_id` | `replyToId` | `String?` | **Có** | ID tin nhắn được trích dẫn trả lời |
| `status` | `status` | `MessageStatus` | Không | `SENT`, `DELIVERED`, `READ` |
| `is_ephemeral` | `isEphemeral` | `Bool` | Không | Tin nhắn tự hủy (xem 1 lần) |
| `is_edited` | `isEdited` | `Bool` | Không | Tin nhắn đã qua chỉnh sửa |
| `is_unsent` | `isUnsent` | `Bool` | Không | Tin nhắn đã bị thu hồi |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời điểm gửi tin |

#### Bảng `message_reactions` (Thả biểu cảm tin nhắn)
| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID reaction |
| `message_id` | `messageId` | `String` | Không | ID tin nhắn được thả tim/icon |
| `user_id` | `userId` | `String` | Không | Người thả icon |
| `emoji` | `emoji` | `String` | Không | Ký tự emoji (ví dụ: `"❤️"`, `"🔥"`, `"😂"`) |

```swift
// Swift Model
struct Conversation: Codable, Identifiable {
    let id: String
    let isGroup: Bool
    let groupName: String?
    let groupAvatarUrl: String?
    let lastMessageText: String?
    let lastMessageAt: Date?
    let updatedAt: Date
    let members: [ConversationMember]
    let unreadCount: Int?
}

struct ConversationMember: Codable, Identifiable {
    let id: String
    let userId: String
    let role: String // "admin" | "member"
    let isMuted: Bool
    let lastReadAt: Date?
    let user: UserAuthorSummary
}

struct Message: Codable, Identifiable {
    let id: String
    let conversationId: String
    let senderId: String
    let contentType: MessageContentType
    let textContent: String?
    let mediaUrl: String?
    let mediaThumbnail: String?
    let mediaDuration: Double?
    let replyToId: String?
    let status: MessageStatus
    let isEphemeral: Bool
    let isEdited: Bool
    let isUnsent: Bool
    let createdAt: Date
    
    let reactions: [MessageReaction]?
}

struct MessageReaction: Codable, Identifiable {
    let id: String
    let messageId: String
    let userId: String
    let emoji: String
}
```

---

### 3.7. Bảng `notifications` (Thông báo)
*Mô tả: Thông báo tương tác (Like, Comment, Follow).*

| Tên DB | Tên JSON API | Kiểu Swift | Nullable? | Mô tả |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `id` | `String` | Không | ID thông báo |
| `recipient_id` | `recipientId` | `String` | Không | Người nhận thông báo |
| `actor_id` | `actorId` | `String` | Không | Người thực hiện hành động |
| `type` | `type` | `NotificationType`| Không | `LIKE`, `COMMENT`, `FOLLOW`, v.v. |
| `reference_type` | `referenceType` | `String?` | **Có** | `"post"`, `"reel"`, `"story"`, `"comment"` |
| `reference_id` | `referenceId` | `String?` | **Có** | ID của đối tượng liên quan |
| `preview_text` | `previewText` | `String?` | **Có** | Chữ xem trước (nội dung comment) |
| `thumbnail_url` | `thumbnailUrl` | `String?` | **Có** | Ảnh thumbnail của bài post/reel được like |
| `deep_link` | `deepLink` | `String?` | **Có** | Đường link điều hướng nhanh |
| `is_read` | `isRead` | `Bool` | Không | Đã đọc chưa (`true`/`false`) |
| `created_at` | `createdAt` | `Date` (ISO) | Không | Thời gian nhận thông báo |

```swift
// Swift Model
struct AppNotification: Codable, Identifiable {
    let id: String
    let recipientId: String
    let actorId: String
    let type: NotificationType
    let referenceType: String?
    let referenceId: String?
    let previewText: String?
    let thumbnailUrl: String?
    let deepLink: String?
    let isRead: Bool
    let createdAt: Date
    let actor: UserAuthorSummary?
}
```

---

## 4. TỔNG KẾT BẢNG MAPPING QUY TẮC DECODE (TIPS CHO iOS DEVELOPER)

1. **Date Decoding:** 
   Khởi tạo `JSONDecoder` với chuẩn ISO 8601:
   ```swift
   let decoder = JSONDecoder()
   decoder.dateDecodingStrategy = .iso8601
   ```
2. **Key Decoding Strategy:**
   Toàn bộ API trả về đã là `camelCase` chuẩn của Swift. Vì vậy để `.useDefaultKeys`:
   ```swift
   decoder.keyDecodingStrategy = .useDefaultKeys
   ```
3. **Optional Handling:**
   Mọi trường có đánh dấu **Có (Nullable)** trong bảng trên bắt buộc phải khai báo dưới dạng **Optional (`?`)** trong Swift Struct để tránh bị crash khi decode dữ liệu rỗng.
