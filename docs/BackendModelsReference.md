# Tài Liệu Tổng Hợp Các Object Models Decode Từ Backend (Client iOS)

> **Mục tiêu**: Cung cấp tài liệu tra cứu toàn diện và chính xác 100% về tất cả các cấu trúc dữ liệu (**DTOs**, **Response Envelopes**, **WebSocket Events**, **WebRTC/Mediasoup Signaling**, và **TUS Resumable Upload**) mà ứng dụng Instagram iOS đang giải mã (**decode**) từ Backend v2.0.

---

## 1. Tổng Quan Kiến Trúc Giải Mã Dữ Liệu (Decoding Architecture)

Client iOS tuân thủ nghiêm ngặt **Clean Architecture** (`Presentations → Domain ← Data`) cùng **Modern Swift Concurrency** (Swift 6 & `@MainActor` isolation):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               LUỒNG GIẢI MÃ DỮ LIỆU TỪ BACKEND                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [ BACKEND SERVICES ] (REST API v2.0 / WebSocket Node / Mediasoup SFU / Neon S3)       │
│           │                                                                            │
│           ▼ (Raw Bytes / JSON UTF-8 / WebSocket Frames)                                │
│  [ NETWORK LAYER ] (Alamofire Session / URLSessionWebSocketTask / MediasoupClient)    │
│           │                                                                            │
│           ▼ (Decode trong Background Thread - Không block Main Thread)                 │
│  [ DTOs & INBOUND MODELS ] (Data/DTOs, nonisolated struct: Decodable & Sendable)      │
│           │                                                                            │
│           ▼ (Chuyển đổi thực thể sạch via Data/Mappers: DTO -> Domain Entity)          │
│  [ CLEAN DOMAIN ENTITIES ] (Domain/Entities: User, Post, Reel, Story, Message, Call...) │
│           │                                                                            │
│           ▼ (Cung cấp cho UI qua @MainActor ViewModel)                                 │
│  [ PRESENTATIONS ] (SwiftUI Views: 60/120 FPS mượt mà, không giật lag)                 │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Các Quy Tắc Decode Cốt Lõi:
1. **Decoder Configuration**:
   - `keyDecodingStrategy = .useDefaultKeys`: JSON từ Backend đã được chuẩn hóa **camelCase** (ví dụ: `authorId`, `avatarUrl`, `isVerified`).
   - `dateDecodingStrategy = .iso8601WithFractionalSeconds`: Parse chuỗi ngày giờ định dạng `yyyy-MM-dd'T'HH:mm:ss.SSSZ`.
2. **Luôn Bọc Gói Trong API Envelope (`APIEnvelope<T>`)**:
   Mọi REST API response đều được bọc trong phong bì tiêu chuẩn:
   ```json
   {
     "success": true,
     "data": { ... },
     "error": null,
     "message": null
   }
   ```
3. **Phân Trang Đa Hình (Polymorphic Pagination)**:
   - **Cursor-based** (Feed, Explore, Reels, Saved): `?cursor=...&perPage=20` &rarr; trả về `{ items, nextCursor, hasMore }`.
   - **Offset-based** (Followers, Search, Comments): `?page=1&perPage=20` &rarr; trả về `{ items, page, perPage, total, hasMore }`.
4. **Cơ Chế Linh Hoạt (Flexible Decoding Fallbacks)**:
   - Hỗ trợ giải mã an toàn các trường số thực (`Double`) khi Backend trả về kiểu số nguyên (`Int`) hoặc chuỗi ký tự (`String`) (áp dụng cho `duration`, `locationLat`, `locationLng`).
   - Hỗ trợ giải mã danh sách story theo cả 2 định dạng: nhóm theo user (`UserStoryGroupDTO`) hoặc mảng phẳng (`StoryDTO`).

---

## 2. Mục Lục Tra Cứu Theo Domain Nghiệp Vụ

- [1. Core Network & Envelopes](#1-core-network--envelopes)
- [2. Auth & Session](#2-auth--session)
- [3. User & Settings](#3-user--settings)
- [4. Posts & Feed](#4-posts--feed)
- [5. Reels](#5-reels)
- [6. Comments](#6-comments)
- [7. Stories](#7-stories)
- [8. Direct Messages & Chat](#8-direct-messages--chat)
- [9. Notifications](#9-notifications)
- [10. Search & Explore](#10-search--explore)
- [11. Reports](#11-reports)
- [12. Calls & CallKit](#12-calls--callkit)
- [13. Storage & Upload (Presigned & TUS)](#13-storage--upload-presigned--tus)
- [14. Realtime WebSocket & Mediasoup WebRTC](#14-realtime-websocket--mediasoup-webrtc)

---

## 1. Core Network & Envelopes

Định nghĩa tại: [APIEndPoint.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/Networking/APIEndPoint.swift), [NetworkService.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/Networking/NetworkService.swift), [PaginatedDataDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/PaginatedDataDTO.swift).

### 1.1. `APIEnvelope<T>`
- **Mục đích**: Gói phong bì phản hồi chuẩn hóa của toàn bộ hệ thống REST API Backend.
- **Khai báo**: `nonisolated struct APIEnvelope<T: Decodable & Sendable>: Decodable, Sendable`

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `success` | `Bool?` | Tùy chọn | `true` nếu xử lý thành công, `false` nếu lỗi |
| `data` | `T?` | Tùy chọn | Payload nghiệp vụ cụ thể (chỉ có khi `success == true`) |
| `error` | `String?` | Tùy chọn | Mã lỗi viết hoa từ server (ví dụ: `UNAUTHORIZED`, `NOT_FOUND`) |
| `message` | `String?` | Tùy chọn | Thông điệp lỗi chi tiết cho người dùng |

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "message": null
}
```

### 1.2. `EmptyResponse`
- **Mục đích**: Decode cho các API trả về data rỗng (`null` hoặc `{}`) khi chỉ cần xác nhận mã lỗi trong envelope.
- **Khai báo**: `nonisolated struct EmptyResponse: Decodable, Sendable {}`

### 1.3. `CursorPaginatedData<T>`
- **Mục đích**: Phân trang theo con trỏ thời gian (Cursor-based) dùng cho Feeds, Explore, Saved.
- **Khai báo**: `nonisolated struct CursorPaginatedData<T: Decodable & Sendable>: Decodable, Sendable`

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `items` | `[T]` | Bắt buộc | Danh sách các đối tượng dữ liệu |
| `nextCursor` | `String?` | Tùy chọn | Con trỏ ISO8601 để tải trang tiếp theo (nil nếu hết dữ liệu) |
| `hasMore` | `Bool` | Bắt buộc | Cờ báo hiệu còn dữ liệu tiếp theo hay không |

```json
{
  "items": [ ... ],
  "nextCursor": "2026-11-25T14:00:00.000Z",
  "hasMore": true
}
```

### 1.4. `OffsetPaginatedData<T>`
- **Mục đích**: Phân trang theo số trang truyền thống (Page/Offset) dùng cho Followers, Search, Notifications.
- **Khai báo**: `nonisolated struct OffsetPaginatedData<T: Decodable & Sendable>: Decodable, Sendable`

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `items` | `[T]` | Bắt buộc | Danh sách đối tượng |
| `page` | `Int` | Bắt buộc | Số trang hiện tại (bắt đầu từ 1) |
| `perPage` | `Int` | Bắt buộc | Số lượng bản ghi trên một trang |
| `total` | `Int` | Bắt buộc | Tổng số bản ghi trong hệ thống |
| `hasMore` | `Bool` | Bắt buộc | Còn trang kế tiếp hay không |

```json
{
  "items": [ ... ],
  "page": 1,
  "perPage": 20,
  "total": 145,
  "hasMore": true
}
```

### 1.5. `UserAuthorSummaryDTO`
- **Mục đích**: Đối tượng tóm tắt tác giả siêu nhẹ được nhúng xuyên suốt trong Post, Reel, Story, Comment, Notification, Conversation Member.
- **Khai báo**: `nonisolated struct UserAuthorSummaryDTO: Decodable, Sendable, Identifiable`
- **Entity đích**: `User` (chuyển đổi qua biến tiện ích `.user`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID định danh người dùng |
| `username` | `String?` | Tùy chọn | Tên người dùng |
| `fullName` | `String?` | Tùy chọn | Tên hiển thị đầy đủ |
| `avatarUrl` | `String?` | Tùy chọn | URL ảnh đại diện |
| `isVerified` | `Bool?` | Tùy chọn | Tích xanh xác minh |
| `isFollowing` | `Bool?` | Tùy chọn | Trạng thái người dùng hiện tại đã follow chưa |
| `isPrivate` | `Bool?` | Tùy chọn | Tài khoản riêng tư |

---

## 2. Auth & Session

Định nghĩa tại: [RemoteAuthDataSource.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DataSources/Remote/RemoteAuthDataSource.swift).

### 2.1. `AuthResponseDTO`
- **Kênh nhận**: `POST /v1/auth/login`, `POST /v1/auth/register`
- **Entity đích**: `AuthSession` (chuyển đổi qua phương thức `.toAuthSession(...)`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `user` | `UserDTO` | Bắt buộc | Thông tin người dùng đăng nhập thành công |
| `accessToken` | `String?` | Tùy chọn | Better Auth JWT token (thời hạn 15 phút) |
| `refreshToken` | `String?` | Tùy chọn | Refresh token (thời hạn 7 ngày sliding window) |
| `expiresAt` | `Int?` | Tùy chọn | Unix epoch timestamp hết hạn token |

```json
{
  "user": {
    "id": "usr_999",
    "username": "tomthecat",
    "email": "tom@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "d8f7e2a1-...",
  "expiresAt": 1795618800
}
```

### 2.2. `RefreshTokenDTO`
- **Kênh nhận**: `POST /v1/auth/refresh` (gửi kèm header `Authorization: Bearer <refreshToken>`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `accessToken` | `String` | Bắt buộc | Access token mới |
| `refreshToken` | `String?` | Tùy chọn | Refresh token mới nếu được xoay vòng (rotated) |
| `expiresAt` | `Int?` | Tùy chọn | Timestamp hết hạn mới |

---

## 3. User & Settings

Định nghĩa tại: [UserDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/UserDTO.swift), [UserSettingsDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/UserSettingsDTO.swift).

### 3.1. `UserDTO`
- **Kênh nhận**: `GET /v1/users/me`, `GET /v1/users/:id`, `PATCH /v1/users/me/name`, `PUT /v1/users/me`
- **Entity đích**: `User` (chuyển đổi qua `UserMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả & Logic Fallback |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID người dùng |
| `firebaseUid` | `String?` | Tùy chọn | UID tương thích Firebase cũ |
| `username` | `String?` | Tùy chọn | Tên đăng nhập |
| `name` | `String?` | Tùy chọn | Tên người dùng |
| `fullName` | `String?` | Tùy chọn | Họ và tên đầy đủ |
| `email` | `String?` | Tùy chọn | Địa chỉ email |
| `phone` | `String?` | Tùy chọn | Số điện thoại |
| `avatarUrl` | `String?` | Tùy chọn | URL ảnh đại diện gốc |
| `avatarThumbUrl` | `String?` | Tùy chọn | URL ảnh đại diện thumbnail tối ưu |
| `bio` | `String?` | Tùy chọn | Tiểu sử cá nhân |
| `website` | `String?` | Tùy chọn | Liên kết web cá nhân |
| `isVerified` | `Bool?` | Tùy chọn | Huy hiệu xác thực |
| `isPrivate` | `Bool?` | Tùy chọn | Chế độ riêng tư |
| `isBusiness` | `Bool?` | Tùy chọn | Tài khoản doanh nghiệp |
| `businessCategory` | `String?` | Tùy chọn | Lĩnh vực kinh doanh |
| `followersCount` | `Int?` | Tùy chọn | Số người theo dõi |
| `followingCount` | `Int?` | Tùy chọn | Số người đang theo dõi |
| `postsCount` | `Int?` | Tùy chọn | Tổng số bài viết |
| `reelsCount` | `Int?` | Tùy chọn | Tổng số reels |
| `settings` | `UserSettingsDTO?` | Tùy chọn | Cài đặt cá nhân đính kèm |
| `createdAt` | `String?` | Tùy chọn | Ngày tạo tài khoản ISO8601 |
| `updatedAt` | `String?` | Tùy chọn | Ngày cập nhật |
| `isFollowing` | `Bool?` | Tùy chọn | Trạng thái follow (trong profile) |
| `isFollowedBy` | `Bool?` | Tùy chọn | Trạng thái người này có follow mình không |
| `isBlocked` | `Bool?` | Tùy chọn | Trạng thái đã chặn |

```json
{
  "id": "ddc20ee7-c705-4622-8431-deaff120408b",
  "username": "john_doe",
  "fullName": "John Doe",
  "email": "user@example.com",
  "avatarUrl": "https://cdn.example.com/avatars/john.jpg",
  "isVerified": false,
  "isPrivate": false,
  "followersCount": 120,
  "followingCount": 85,
  "postsCount": 12,
  "createdAt": "2026-08-04T14:37:10.661Z"
}
```

### 3.2. `UserWrapperDTO` & `PaginatedUsersDTO`
- `UserWrapperDTO`: `{ "user": UserDTO }` dùng cho các API trả về user bọc trong envelope.
- `PaginatedUsersDTO`: `{ items: [UserDTO], page: Int, perPage: Int, total: Int, hasMore: Bool }` dùng cho danh sách Followers, Following, Suggested, Blocked, Search Users.

### 3.3. `UserSettingsDTO` & `UserSettingsWrapperDTO`
- **Kênh nhận**: `GET /v1/users/me/settings`, `PUT /v1/users/me/settings`
- **Entity đích**: `UserSettings` (qua `UserSettingsMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `language` | `String?` | Tùy chọn | Mã ngôn ngữ ("vi", "en") |
| `darkMode` | `Bool?` | Tùy chọn | Trạng thái giao diện tối |
| `biometricEnabled` | `Bool?` | Tùy chọn | Đăng nhập bằng sinh trắc học |
| `pushEnabled` | `Bool?` | Tùy chọn | Bật/tắt thông báo đẩy |
| `likeNotifications` | `Bool?` | Tùy chọn | Báo khi có lượt thích |
| `commentNotifications`| `Bool?` | Tùy chọn | Báo khi có bình luận |
| `followNotifications` | `Bool?` | Tùy chọn | Báo khi có người follow |
| `directMessageNotifications`| `Bool?` | Tùy chọn | Báo khi có tin nhắn |
| `activityStatusVisible`| `Bool?` | Tùy chọn | Hiển thị trạng thái hoạt động |
| `highQualityUploads` | `Bool?` | Tùy chọn | Tải lên chất lượng cao |
| `cellularDataEnabled`| `Bool?` | Tùy chọn | Dùng dữ liệu di động |

### 3.4. `DeviceTokensDTO` & `DeviceTokenDTO`
- **Kênh nhận**: `GET /v1/users/me/device-tokens`
- `DeviceTokenDTO`: `{ id: String, token: String, platform: String, createdAt: String }`

---

## 4. Posts & Feed

Định nghĩa tại: [PostDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/PostDTO.swift).

### 4.1. `PostDTO`
- **Kênh nhận**: `GET /v1/posts/feed`, `GET /v1/posts/explore`, `GET /v1/posts/saved`, `GET /v1/posts/user/:id`, `GET /v1/posts/:id`, `POST /v1/posts`, `PUT /v1/posts/:id`
- **Entity đích**: `Post` (chuyển đổi qua `PostMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Cơ Chế Giải Mã Đặc Biệt (Flexible Decoding) |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID bài viết |
| `authorId` | `String` | Bắt buộc | ID tác giả bài viết |
| `caption` | `String?` | Tùy chọn | Nội dung mô tả bài viết |
| `locationName` | `String?` | Tùy chọn | Tên địa điểm |
| `locationLat` | `Double?` | Tùy chọn | **Linh hoạt**: Giải mã an toàn từ `Double`, `String`, hoặc `Int` (hỗ trợ Postgres Decimal/Numeric) |
| `locationLng` | `Double?` | Tùy chọn | **Linh hoạt**: Giải mã an toàn từ `Double`, `String`, hoặc `Int` (hỗ trợ Postgres Decimal/Numeric) |
| `likesCount` | `Int` | Mặc định 0 | Số lượt thích |
| `commentsCount`| `Int` | Mặc định 0 | Số lượt bình luận |
| `sharesCount` | `Int` | Mặc định 0 | Số lượt chia sẻ |
| `savesCount` | `Int` | Mặc định 0 | Số lượt lưu bài |
| `viewsCount` | `Int` | Mặc định 0 | Số lượt xem |
| `isSponsored` | `Bool` | Mặc định false | Bài viết được tài trợ |
| `sponsorUserId`| `String?`| Tùy chọn | ID nhà tài trợ |
| `audience` | `String?` | Tùy chọn | "PUBLIC", "FOLLOWERS", "CLOSE_FRIENDS" |
| `closeFriendsOnly`| `Bool` | Mặc định false | Chỉ bạn thân mới xem được |
| `createdAt` | `String` | Bắt buộc | Thời gian tạo ISO8601 |
| `updatedAt` | `String?` | Tùy chọn | Thời gian cập nhật |
| `author` | `PostUserDTO` | Bắt buộc | Thông tin tác giả bài viết |
| `mediaItems` | `[MediaItemDTO]` | Mặc định [] | Danh sách hình ảnh / video trong bài viết carousel |
| `isLiked` | `Bool?` | Tùy chọn | Người dùng hiện tại đã thích chưa |
| `isSaved` | `Bool?` | Tùy chọn | Người dùng hiện tại đã lưu chưa |

```json
{
  "id": "post_1001",
  "authorId": "usr_999",
  "caption": "Exploring beautiful Vietnam!",
  "locationName": "Da Nang, Vietnam",
  "locationLat": 16.0544,
  "locationLng": 108.2022,
  "likesCount": 240,
  "commentsCount": 18,
  "createdAt": "2026-11-20T08:30:00.000Z",
  "author": {
    "id": "usr_999",
    "username": "tomthecat",
    "avatarUrl": "https://cdn.example.com/avatars/tom.jpg"
  },
  "mediaItems": [
    {
      "id": "med_1",
      "url": "https://cdn.example.com/posts/danang.jpg",
      "type": "IMAGE",
      "width": 1080,
      "height": 1350
    }
  ],
  "isLiked": true,
  "isSaved": false
}
```

### 4.2. `MediaItemDTO`
- **Khai báo**: `nonisolated struct MediaItemDTO: Decodable, Sendable`
- **Flexible Duration**: `duration` giải mã an toàn từ `Double`, `Int`, hoặc `String`.

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID item media |
| `postId` | `String?` | Tùy chọn | ID bài viết cha |
| `url` | `String` | Bắt buộc | Đường dẫn media trên CDN |
| `thumbnailUrl` | `String?` | Tùy chọn | Ảnh thu nhỏ (đối với video) |
| `type` | `String` | Mặc định "IMAGE" | "IMAGE" hoặc "VIDEO" |
| `width` | `Int?` | Tùy chọn | Chiều rộng gốc tính bằng pixel |
| `height` | `Int?` | Tùy chọn | Chiều cao gốc tính bằng pixel |
| `duration` | `Double?` | Tùy chọn | Thời lượng video (giây) |
| `sortOrder` | `Int?` | Tùy chọn | Thứ tự trong bài viết carousel |

### 4.3. `PostUserDTO`, `PostWrapperDTO`, `PaginatedPostsDTO`
- `PostUserDTO`: `{ id, username, fullName, isVerified, isFollowing, isPrivate, avatarUrl }`
- `PostWrapperDTO`: `{ "post": PostDTO }`
- `PaginatedPostsDTO`: Hỗ trợ cả Cursor-based (`items`, `nextCursor`, `hasMore`) lẫn Offset-based (`items`, `page`, `perPage`, `total`, `hasMore`).

---

## 5. Reels

Định nghĩa tại: [ReelDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/ReelDTO.swift).

### 5.1. `ReelDTO`
- **Kênh nhận**: `GET /v1/reels/feed`, `GET /v1/reels/:id`, `GET /v1/reels/user/:id`, `POST /v1/reels`
- **Entity đích**: `Reel` (chuyển đổi qua `ReelMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Cơ Chế Giải Mã & Fallback |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID định danh của Reel |
| `authorId` | `String` | Bắt buộc | ID tác giả |
| `videoUrl` | `String` | Bắt buộc | URL video stream |
| `thumbnailUrl` | `String?` | Tùy chọn | URL thumbnail video |
| `caption` | `String?` | Tùy chọn | Chú thích video |
| `audioId` | `String?` | Tùy chọn | ID bài hát / âm thanh |
| `audioName` | `String?` | Tùy chọn | Tên bài hát |
| `audioArtist` | `String?` | Tùy chọn | Tên nghệ sĩ |
| `audioCoverUrl`| `String?` | Tùy chọn | Ảnh bìa bài hát |
| `isOriginalAudio`| `Bool?` | Tùy chọn | Âm thanh gốc do người đăng tạo ra |
| `duration` | `Double?` | Tùy chọn | **Linh hoạt**: Giải mã từ `Double`, `Int`, hoặc chuỗi `String` |
| `likesCount` | `Int?` | Tùy chọn | Lượt thích |
| `commentsCount`| `Int?` | Tùy chọn | Lượt bình luận |
| `sharesCount` | `Int?` | Tùy chọn | Lượt chia sẻ |
| `savesCount` | `Int?` | Tùy chọn | Lượt lưu video |
| `viewsCount` | `Int?` | Tùy chọn | Lượt xem |
| `allowRemix` | `Bool?` | Tùy chọn | Cho phép remix video |
| `allowDownload`| `Bool?` | Tùy chọn | Cho phép tải về |
| `createdAt` | `String` | Bắt buộc | Thời gian tạo ISO8601 |
| `author` | `ReelAuthorDTO`| Bắt buộc | Tác giả reel |
| `isLiked` | `Bool?` | Tùy chọn | Trạng thái like |
| `isSaved` | `Bool?` | Tùy chọn | Trạng thái lưu |

```json
{
  "id": "reel_001",
  "authorId": "usr_100",
  "videoUrl": "https://cdn.example.com/reels/video.mp4",
  "thumbnailUrl": "https://cdn.example.com/reels/thumb.jpg",
  "caption": "Amazing sunset timelapse",
  "audioId": "audio_55",
  "audioName": "Golden Hour",
  "audioArtist": "JVKE",
  "duration": 15.5,
  "likesCount": 1420,
  "commentsCount": 85,
  "createdAt": "2026-11-24T18:00:00.000Z",
  "author": {
    "id": "usr_100",
    "username": "kiro_dev",
    "avatarUrl": "https://cdn.example.com/avatars/kiro.jpg",
    "isVerified": true
  }
}
```

### 5.2. `ReelAuthorDTO`, `ReelWrapperDTO`, `PaginatedReelsDTO`
- `ReelAuthorDTO`: `{ id, username, fullName, avatarUrl, isVerified, isFollowing }`
- `ReelWrapperDTO`: `{ "reel": ReelDTO }`
- `PaginatedReelsDTO`: `{ items: [ReelDTO], nextCursor: String?, hasMore: Bool, page: Int?, perPage: Int?, total: Int? }`

---

## 6. Comments

Định nghĩa tại: [CommentDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/CommentDTO.swift).

### 6.1. `CommentDTO`
- **Kênh nhận**: `GET /v1/posts/:id/comments`, `GET /v1/reels/:id/comments`, `GET /v1/stories/:id/comments`, `POST /v1/.../comments`
- **Entity đích**: `Comment` (chuyển đổi qua `CommentMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Cơ Chế Đa Hình & Fallback |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID bình luận |
| `commentableType`| `String?`| Tùy chọn | "POST", "REEL", "STORY" (tự động phân loại qua `resolvedCommentableType`) |
| `commentableId` | `String?` | Tùy chọn | ID bài viết/reel/story cha |
| `postId` | `String?` | Tùy chọn | Fallback tương thích ngược cho `commentableId` |
| `authorId` | `String?` | Tùy chọn | ID người bình luận |
| `text` | `String` | Bắt buộc | Nội dung văn bản bình luận |
| `parentId` | `String?` | Tùy chọn | ID comment cha nếu là câu trả lời (reply) |
| `likesCount` | `Int` | Mặc định 0 | Lượt thích bình luận |
| `repliesCount` | `Int?` | Tùy chọn | Số câu trả lời con |
| `createdAt` | `String` | Bắt buộc | Thời gian đăng ISO8601 |
| `author` | `CommentAuthorDTO`| Bắt buộc | Tự động parse từ key `author` hoặc fallback sang `user` |
| `replies` | `[CommentDTO]?`| Tùy chọn | Danh sách replies lồng nhau |
| `isLiked` | `Bool?` | Tùy chọn | Trạng thái like của người dùng hiện tại |

```json
{
  "id": "cmt_501",
  "commentableType": "POST",
  "commentableId": "post_1001",
  "authorId": "usr_200",
  "text": "Stunning shot! Where was this taken?",
  "likesCount": 12,
  "repliesCount": 1,
  "createdAt": "2026-11-20T09:15:00.000Z",
  "author": {
    "id": "usr_200",
    "username": "anna",
    "avatarUrl": "https://cdn.example.com/avatars/anna.jpg",
    "isVerified": false
  }
}
```

### 6.2. `CommentAuthorDTO`, `CommentWrapperDTO`, `PaginatedCommentsDTO`
- `CommentAuthorDTO`: `{ id, username, fullName, avatarUrl, isVerified, isFollowing }`
- `CommentWrapperDTO`: `{ "comment": CommentDTO }`
- `PaginatedCommentsDTO`: Hỗ trợ phân trang kép (Cursor `{ items, nextCursor, hasMore }` hoặc Offset `{ items, page, perPage, total, hasMore }`).

---

## 7. Stories

Định nghĩa tại: [StoryDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/StoryDTO.swift).

### 7.1. `StoriesFeedDTO` & `UserStoryGroupDTO` (Polymorphic Grouped vs Flat Feed)
- **Kênh nhận**: `GET /v1/stories/feed`
- **Cơ chế đặc biệt**: Backend v2.0 trả về danh sách story được nhóm theo người dùng (`[UserStoryGroupDTO]`). `StoriesFeedDTO` tự động kiểm tra định dạng và làm phẳng (flatten) thành `[StoryDTO]` kèm gán `authorId` và `author`. Nếu gặp payload phẳng cũ (`[StoryDTO]`), decoder sẽ tự fallback mượt mà.

| Trường của `UserStoryGroupDTO` | Kiểu Swift | Mô tả |
|---|---|---|
| `userId` | `String` | ID của người dùng sở hữu nhóm story |
| `author` | `UserStoryDTO` | Thông tin tác giả |
| `stories` | `[StoryDTO]` | Mảng các story của người dùng đó |

```json
{
  "items": [
    {
      "userId": "usr_100",
      "author": {
        "id": "usr_100",
        "username": "kiro_dev",
        "avatarUrl": "https://cdn.example.com/avatars/kiro.jpg"
      },
      "stories": [
        {
          "id": "sty_001",
          "items": [ ... ]
        }
      ]
    }
  ]
}
```

### 7.2. `StoryDTO` & `StoryItemDTO`
- **Entity đích**: `Story` (chuyển đổi qua `StoryMapper.toEntity`)

| Trường của `StoryDTO` | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID của Story |
| `authorId` | `String?` | Tùy chọn | ID tác giả (tự inject từ GroupDTO nếu thiếu) |
| `audience` | `String?` | Tùy chọn | Phạm vi hiển thị ("PUBLIC", "CLOSE_FRIENDS") |
| `viewsCount` | `Int?` | Tùy chọn | Tổng lượt xem |
| `repliesCount` | `Int?` | Tùy chọn | Tổng câu trả lời |
| `createdAt` | `String?` | Tùy chọn | Thời gian tạo |
| `expiresAt` | `String?` | Tùy chọn | Thời gian hết hạn (sau 24h) |
| `author` | `UserStoryDTO?`| Tùy chọn | Tác giả story |
| `items` | `[StoryItemDTO]`| Mặc định [] | Các trang media của story |
| `viewed` | `Bool?` | Tùy chọn | Đã xem chưa |
| `views` | `[StoryViewDTO]?`| Tùy chọn | Danh sách người xem |

| Trường của `StoryItemDTO` | Kiểu Swift | Cơ Chế Giải Mã & Fallback |
|---|---|---|
| `id` | `String` | ID item media |
| `storyId` | `String?` | ID story cha |
| `mediaUrl` | `String` | Đường dẫn CDN ảnh hoặc video |
| `thumbnailUrl` | `String?` | Ảnh thu nhỏ |
| `type` | `String` | "IMAGE" hoặc "VIDEO" (mặc định "IMAGE") |
| `duration` | `Double` | **Linh hoạt**: Giải mã an toàn từ `Double`, `Int`, `String` (fallback 5.0s) |
| `sortOrder` | `Int?` | Thứ tự trình chiếu |
| `stickerType` | `String?` | "poll", "question", "mention", "location", "link", "music" |
| `stickerData` | `String?` | Chuỗi JSON chứa metadata của sticker |
| `createdAt` | `String?` | Thời gian tạo item |

### 7.3. `StoryReplyDTO`, `StoryReactionDTO`, `StoryRepliesResultDTO`
- `StoryReplyDTO`: `{ id, storyId, userId, text, createdAt, user: CommentAuthorDTO, reactions: [StoryReactionDTO]? }`
- `StoryReactionDTO`: `{ id, emoji, userId }`
- `StoryRepliesResultDTO`: `{ replies: [StoryReplyDTO], isCurrentUserOwner: Bool, areRepliesEnabled: Bool }`
- Các wrapper tương ứng: `StoryReplyWrapperDTO`, `StoryRepliesResultWrapperDTO`.

---

## 8. Direct Messages & Chat

Định nghĩa tại: [MessageDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/MessageDTO.swift).

### 8.1. `ConversationDTO`
- **Kênh nhận**: `GET /v1/conversations`, `POST /v1/conversations`, `POST /v1/conversations/group`
- **Entity đích**: `Conversation` (chuyển đổi qua `MessageMapper.toConversation`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID cuộc hội thoại |
| `isGroup` | `Bool` | Bắt buộc | Là chat nhóm hay chat 1-1 |
| `groupName` | `String?` | Tùy chọn | Tên nhóm nếu là chat nhóm |
| `groupAvatar` | `String?` | Tùy chọn | Avatar nhóm |
| `groupAvatarUrl`| `String?` | Tùy chọn | URL avatar nhóm (fallback sang `groupAvatar`) |
| `lastMessageText`| `String?` | Tùy chọn | Tóm tắt tin nhắn cuối |
| `lastMessageAt` | `String?` | Tùy chọn | Thời gian tin nhắn cuối |
| `createdAt` | `String` | Bắt buộc | Ngày tạo hội thoại |
| `updatedAt` | `String` | Bắt buộc | Ngày cập nhật |
| `members` | `[ConversationMemberDTO]`| Bắt buộc | Danh sách thành viên tham gia |
| `lastMessage` | `MessageDTO?` | Tùy chọn | Chi tiết đối tượng tin nhắn cuối cùng |
| `lastReadAt` | `String?` | Tùy chọn | Thời điểm xem tin gần nhất |
| `isMuted` | `Bool?` | Tùy chọn | Cuộc trò chuyện có bị tắt thông báo không |
| `unreadCount` | `Int?` | Tùy chọn | Số tin nhắn chưa đọc |

```json
{
  "id": "conv_99",
  "isGroup": false,
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-25T14:10:00.000Z",
  "unreadCount": 2,
  "members": [
    {
      "id": "mem_1",
      "userId": "usr_100",
      "user": {
        "id": "usr_100",
        "username": "kiro_dev",
        "avatarUrl": "https://cdn.example.com/avatars/kiro.jpg"
      }
    }
  ],
  "lastMessage": {
    "id": "msg_888",
    "conversationId": "conv_99",
    "senderId": "usr_100",
    "contentType": "TEXT",
    "textContent": "Hey, did you check the new update?",
    "status": "SENT",
    "createdAt": "2026-11-25T14:10:00.000Z"
  }
}
```

### 8.2. `ConversationMemberDTO`
- **Khai báo**: `nonisolated struct ConversationMemberDTO: Decodable, Sendable`
- **Cơ chế linh hoạt**: Tự động lấy ID và thông tin từ object lồng `user` (`UserAuthorSummaryDTO`), hoặc fallback sang các trường phẳng (`userId`, `username`, `fullName`, `avatarUrl`, `isVerified`).

### 8.3. `MessageDTO`
- **Kênh nhận**: `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages/media`
- **Entity đích**: `Message` (chuyển đổi qua `MessageMapper.toMessage`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Mô tả |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID tin nhắn |
| `conversationId` | `String` | Bắt buộc | ID hội thoại chứa tin |
| `senderId` | `String` | Bắt buộc | ID người gửi |
| `contentType` | `String` | Bắt buộc | "TEXT", "IMAGE", "VIDEO", "AUDIO", "POST_SHARE", "STORY_SHARE", "REEL_SHARE", "VOICE", "SYSTEM" |
| `textContent` | `String?` | Tùy chọn | Nội dung tin nhắn văn bản |
| `mediaUrl` | `String?` | Tùy chọn | URL ảnh/video/audio gửi kèm |
| `mediaThumbnail` | `String?` | Tùy chọn | Thumbnail cho video |
| `mediaDuration` | `Double?` | Tùy chọn | Thời lượng ghi âm / video |
| `referenceId` | `String?` | Tùy chọn | ID bài viết/story/reel khi chia sẻ nội dung |
| `replyToId` | `String?` | Tùy chọn | ID tin nhắn đang trả lời |
| `status` | `String` | Bắt buộc | "SENT", "DELIVERED", "READ" |
| `isEphemeral` | `Bool?` | Tùy chọn | Tin nhắn tự biến mất (Vanish mode) |
| `isEdited` | `Bool?` | Tùy chọn | Tin nhắn đã qua chỉnh sửa |
| `isUnsent` | `Bool?` | Tùy chọn | Tin nhắn đã bị thu hồi |
| `createdAt` | `String` | Bắt buộc | Thời điểm gửi ISO8601 |
| `sender` | `MessageSenderDTO?`| Tùy chọn | Thông tin người gửi (có trong chi tiết) |
| `reactions` | `[MessageReactionDTO]?`| Tùy chọn | Danh sách thả cảm xúc emoji |

### 8.4. `GroupDetailsDTO`, `GroupMemberDTO`, `SharedMediaDTO`
- `GroupDetailsDTO`: `{ name, avatarUrl, members: [GroupMemberDTO], adminIds: [String], sharedMedia: [SharedMediaDTO], muteMessages: Bool, muteCalls: Bool }`
- `SharedMediaDTO`: `{ id, type, thumbnailUrl, mediaUrl, isVideo: Bool }`
- `PaginatedConversationsDTO` & `PaginatedMessagesDTO`: Danh sách phân trang tin nhắn và hội thoại.

---

## 9. Notifications

Định nghĩa tại: [NotificationDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/NotificationDTO.swift).

### 9.1. `NotificationDTO`
- **Kênh nhận**: `GET /v1/notifications`
- **Entity đích**: `AppNotification` (chuyển đổi qua `NotificationMapper.toEntity`)

| Trường | Kiểu Swift | Bắt buộc/Tùy chọn | Logic Fallback Hỗ Trợ Legacy Backend |
|---|---|---|---|
| `id` | `String` | Bắt buộc | ID thông báo |
| `recipientId` | `String` | Bắt buộc | Người nhận thông báo |
| `actorId` | `String` | Bắt buộc | Người tạo ra tương tác |
| `type` | `String` | Bắt buộc | "like", "comment", "follow", "mention", "call" |
| `referenceType` | `String?` | Tùy chọn | "post", "reel", "story", "comment" |
| `referenceId` | `String?` | Tùy chọn | `resolvedReferenceId` fallback sang `postId` |
| `previewText` | `String?` | Tùy chọn | `resolvedPreviewText` fallback sang `commentText` |
| `thumbnailUrl` | `String?` | Tùy chọn | `resolvedThumbnailUrl` fallback sang `postThumbnailUrl` |
| `deepLink` | `String?` | Tùy chọn | Deep link điều hướng màn hình |
| `isRead` | `Bool` | Bắt buộc | Trạng thái đã đọc |
| `createdAt` | `String` | Bắt buộc | Thời gian tạo ISO8601 |
| `actor` | `NotificationActorDTO`| Bắt buộc | Thông tin người thực hiện hành động |

```json
{
  "id": "notif_77",
  "recipientId": "usr_999",
  "actorId": "usr_100",
  "type": "like",
  "referenceType": "post",
  "referenceId": "post_1001",
  "thumbnailUrl": "https://cdn.example.com/posts/danang_thumb.jpg",
  "isRead": false,
  "createdAt": "2026-11-25T13:45:00.000Z",
  "actor": {
    "id": "usr_100",
    "username": "kiro_dev",
    "avatarUrl": "https://cdn.example.com/avatars/kiro.jpg",
    "isVerified": true,
    "isFollowing": true
  }
}
```

### 9.2. `PaginatedNotificationsDTO` & `UnreadCountDTO`
- `PaginatedNotificationsDTO`: `{ items: [NotificationDTO], page: Int, perPage: Int, total: Int, hasMore: Bool }`
- `UnreadCountDTO`: `{ count: Int }` trả về từ `GET /v1/notifications/unread-count`.

---

## 10. Search & Explore

Định nghĩa tại: [SearchDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/SearchDTO.swift).

### 10.1. `SearchResponseDTO` & `SearchResultItemDTO`
- **Kênh nhận**: `GET /v1/search?q=...&type=...`

| Trường của `SearchResponseDTO` | Kiểu Swift | Mô tả |
|---|---|---|
| `query` | `String` | Chuỗi tìm kiếm |
| `type` | `String` | Loại tìm kiếm ("all", "users", "posts", "reels", "hashtags", "locations") |
| `results` | `[SearchResultItemDTO]` | Danh sách kết quả tìm kiếm |
| `pagination` | `SearchPaginationDTO` | `{ nextCursor: String?, hasMore: Bool }` |
| `tookMs` | `Int` | Thời gian xử lý tìm kiếm của máy chủ (ms) |

| Trường của `SearchResultItemDTO` | Kiểu Swift | Mô tả |
|---|---|---|
| `id` | `String` | ID đối tượng |
| `type` | `SearchResultTypeDTO` | Enum: `user`, `post`, `reel`, `hashtag`, `location`, `audio` |
| `title` | `String` | Tiêu đề chính hiển thị (username, tag name, place name) |
| `subtitle` | `String?` | Phụ đề (full name, count, address) |
| `imageUrl` | `String?` | Ảnh đại diện hoặc thumbnail |
| `metadata` | `[String: String]?` | Thuộc tính mở rộng |

### 10.2. Suggestions, Trending, Analytics
- `SuggestionsResponseDTO`: `{ query: String, suggestions: [SearchSuggestionDTO] }`
  - `SearchSuggestionDTO`: `{ text: String, type: SearchTypeDTO, metadata: [String: String]? }`
- `RecentSearchesResponseDTO`: `{ recent: [RecentSearchDTO] }`
  - `RecentSearchDTO`: `{ query: String, type: String, timestamp: Date }`
- `TrendingResponseDTO`: `{ trending: [TrendingHashtagDTO], timeWindowHours: Int }`
  - `TrendingHashtagDTO`: `{ tag: String, postsCount: Int, reelsCount: Int, trendScore: Double }`
- `AnalyticsResponseDTO`: `{ periodDays: Int, totalSearches: Int, uniqueUsers: Int, topQueries: [SearchQueryStatDTO], searchesByType: [String: Int] }`

### 10.3. Hashtag & Location Pages
- `HashtagPageResponseDTO`: `{ hashtag: HashtagInfoDTO, topPosts: [PostSummaryDTO], topReels: [ReelSummaryDTO] }`
  - `HashtagInfoDTO`: `{ id, tag, postsCount, reelsCount }`
- `LocationPageResponseDTO`: `{ location: LocationInfoDTO, topPosts: [PostSummaryDTO] }`
  - `LocationInfoDTO`: `{ id, name, address, lat: Double, lng: Double, category: String?, postsCount: Int }`
- Lightweight Summaries: `PostSummaryDTO`, `ReelSummaryDTO`, `UserSummaryDTO`, `MediaItemSummaryDTO`.

---

## 11. Reports

Định nghĩa tại: [ReportDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/ReportDTO.swift).

### 11.1. `ReportDTO`
- **Kênh nhận**: `POST /v1/reports`, `GET /v1/reports/me`, `GET /v1/reports/:id`, `GET /v1/reports/all`, `PUT /v1/reports/:id/status`

| Trường | Kiểu Swift | Mô tả |
|---|---|---|
| `id` | `String` | ID báo cáo vi phạm |
| `reporterId` | `String` | ID người tạo báo cáo |
| `type` | `ReportTypeDTO` | Enum: `POST`, `COMMENT`, `REEL`, `STORY`, `USER`, `MESSAGE` |
| `reason` | `ReportReasonDTO`| Enum: `SPAM`, `INAPPROPRIATE_CONTENT`, `HARASSMENT`, `HATE_SPEECH`, `VIOLENCE`, `SEXUAL_CONTENT`, `SELF_HARM`, `FAKE_ACCOUNT`, `INTELLECTUAL_PROPERTY`, `OTHER` |
| `description` | `String?` | Mô tả chi tiết từ người báo cáo |
| `postId`, `commentId`, `reelId`, `storyId`, `userId`, `messageId` | `String?` | ID đối tượng bị báo cáo |
| `status` | `ReportStatusDTO`| Enum: `PENDING`, `REVIEWED`, `RESOLVED`, `DISMISSED` |
| `reviewedBy` | `String?` | ID người kiểm duyệt |
| `reviewedAt` | `Date?` | Thời điểm kiểm duyệt |
| `resolution` | `String?` | Kết luận xử lý vi phạm |
| `createdAt`, `updatedAt` | `Date` | Thời gian tạo và cập nhật |
| `reporter` | `ReporterDTO?` | Thông tin người báo cáo (hiển thị cho admin) |

### 11.2. Response Wrappers Cho Reports
- `ReportResponseDTO`: `{ success: Bool, data: ReportDataDTO?, error: String?, message: String? }`
- `ReportsListResponseDTO`: `{ success: Bool, data: ReportsListDataDTO?, error: String?, message: String? }`
  - `ReportsListDataDTO`: `{ items: [ReportDTO], page: Int, perPage: Int, total: Int, hasMore: Bool }`

---

## 12. Calls & CallKit

Định nghĩa tại: [CallDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/CallDTO.swift), [CallEndpoint.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/Networking/Endpoints/CallEndpoint.swift).

### 12.1. `CallDTO` & `CallParticipantDTO`
- **Kênh nhận**: `GET /v1/calls/history`, `GET /v1/calls/:id`, `POST /v1/calls`, `POST /v1/calls/:id/join`, `PUT /v1/calls/:id`

| Trường của `CallDTO` | Kiểu Swift | Mô tả |
|---|---|---|
| `id` | `String` | ID cuộc gọi |
| `participantIds` | `[String]` | Danh sách ID người tham gia |
| `callType` | `CallType` | `.audio` hoặc `.video` |
| `status` | `CallStatus` | `.initiating`, `.ringing`, `.connecting`, `.connected`, `.ended`, `.missed`, `.rejected`, `.failed` |
| `startedAt`, `endedAt`| `Date` / `Date?` | Thời gian bắt đầu và kết thúc |
| `duration` | `Int?` | Thời lượng cuộc gọi (giây) |
| `participants` | `[CallParticipantDTO]?`| Danh sách chi tiết các người tham gia |
| `conversationId` | `String?` | ID cuộc trò chuyện tương ứng |
| `maxParticipants`| `Int?` | Số lượng người tham gia tối đa |
| `isRecording` | `Bool?` | Đang ghi âm cuộc gọi hay không |
| `recordingUrl` | `String?` | URL file ghi âm |

| Trường của `CallParticipantDTO` | Kiểu Swift | Mô tả |
|---|---|---|
| `userId` | `String` | ID thành viên |
| `joinedAt`, `leftAt` | `Date?` | Thời điểm vào/rời cuộc gọi |
| `user` | `CallUserInfoDTO` | `{ id, username, fullName, avatarUrl }` |
| `isMuted` | `Bool?` | Bật/tắt mic |
| `isVideoOff` | `Bool?` | Bật/tắt camera |
| `isScreenSharing` | `Bool?` | Đang chia sẻ màn hình |
| `mediaState` | `ParticipantMediaStateDTO?`| Trạng thái media tổng hợp |

### 12.2. Call Recording & Quality Metrics
- `CallRecordingDTO`: `{ callId, recordingUrl, startedAt, endedAt, duration, format, size }`
- `QualityMetricsDTO`: `{ callId, participantId, bitrate, packetLoss, latency, jitter, fps, resolution: ResolutionDTO?, timestamp }`
  - `ResolutionDTO`: `{ width: Int, height: Int }`

### 12.3. CallKit & WebRTC ICE Infrastructure
- `CallKitDeviceDTO`: `{ id, token, platform, deviceId, appVersion, osVersion, voipToken, sandbox, topics, lastUsedAt, expiresAt, isActive, createdAt }`
- `IceServerDTO`: `{ urls: [String], username: String?, credential: String? }`
- `CallKitStatsDTO`: `{ service: CallKitServiceStatsDTO, user: CallKitUserStatsDTO }`
- `CallSignalingMessage`: `{ type: CallSignalingType, callId: String, senderId: String, targetId: String, sdp: String?, candidate: IceCandidate?, timestamp: Date }`
- `IceCandidate`: `{ candidate: String, sdpMid: String?, sdpMLineIndex: Int? }`

---

## 13. Storage & Upload (Presigned & TUS)

Định nghĩa tại: [RemoteUploadDataSource.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DataSources/Remote/RemoteUploadDataSource.swift), [TusUseCases.swift](file:///Users/tomthecat/Instagram-SwiftUI/Domain/UseCases/Upload/TusUseCases.swift).

### 13.1. Presigned S3 Flow & Direct Upload DTOs
- `PresignedURLDTO` (`POST /v1/upload/presign`):
  ```swift
  nonisolated struct PresignedURLDTO: Decodable, Sendable {
      let uploadUrl: String        // S3 PUT URL
      let pendingUploadId: String  // ID bản ghi chờ xác nhận
      let storagePath: String      // Đường dẫn lưu trữ trên S3 bucket
      let url: String              // CDN URL sau khi hoàn tất
      let expiresIn: Int           // Thời gian URL còn hiệu lực (giây)
      let width: Int?
      let height: Int?
      let duration: Double?
  }
  ```
- `ConfirmUploadDTO` (`POST /v1/upload/confirm`): `{ pendingUploadId, url, storagePath }`
- `DirectUploadDTO` (`POST /v1/upload/image`): `{ url, width, height, pendingUploadId }`
- `VideoUploadDTO` (`POST /v1/upload/video`): `{ url, thumbnailUrl, duration, width, height, pendingUploadId }`
- `AvatarUploadDTO` (`POST /v1/upload/avatar`): `{ url }`
- `PendingStatusDTO` (`GET /v1/upload/pending/:id`): `{ pendingUploadId, url, storagePath, confirmed: Bool, createdAt: String }`

### 13.2. Resumable TUS Upload Protocol
Được sử dụng cho các tệp video dung lượng lớn (>100MB) hỗ trợ upload từng phần (chunking) và tiếp tục khi mất mạng:
- `TusCreateResponse` (`POST /v1/upload/tus`): `{ uploadId: String, uploadUrl: String, expiresAt: Date? }`
- `TusUploadInfo` (`HEAD / PATCH /v1/upload/tus/:id`): `{ uploadId: String, uploadUrl: String, offset: Int64, expiresAt: Date?, fileSize: Int64 }`
- `TusCompleteResponse` (`POST /v1/upload/tus/:id/complete`): `{ success: Bool, targetUrl: String?, targetId: String? }`
- `TusMetadata`: `{ filename: String, contentType: String, targetType: String, targetId: String?, userId: String }`

---

## 14. Realtime WebSocket & Mediasoup WebRTC

Định nghĩa tại: [WebSocketService.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/WebSocket/WebSocketService.swift), [MediasoupClient.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/Calling/Media/MediasoupClient.swift).

### 14.1. `WSEnvelope`
- **Mục đích**: Gói khung dữ liệu chuẩn hóa cho tất cả message gửi và nhận qua WebSocket.
- **Khai báo**: `struct WSEnvelope: Codable, Sendable`

| Trường | Kiểu Swift | Mô tả |
|---|---|---|
| `eventId` | `String` | ID duy nhất định danh sự kiện (UUID) |
| `sequence` | `Int?` | Số thứ tự tăng dần để sắp xếp và phục hồi event bị rơi rớt |
| `timestamp` | `String` | Thời điểm phát sinh sự kiện ISO8601 |
| `type` | `String` | Loại sự kiện (ví dụ: `new_message`, `typing_start`, `call_incoming`, `call_offer`) |
| `payload` | `AnyCodable` | Payload linh hoạt của sự kiện (type-erased) |
| `ackRequired` | `Bool?` | Server hoặc Client có yêu cầu phản hồi xác nhận (ACK) không |
| `correlationId` | `String?` | ID tương quan cho mô hình request-response |

```json
{
  "eventId": "evt_91283",
  "sequence": 104,
  "timestamp": "2026-11-25T14:12:00.120Z",
  "type": "new_message",
  "payload": {
    "id": "msg_901",
    "conversation_id": "conv_99",
    "sender_id": "usr_100",
    "content": "Hello via WebSocket!",
    "content_type": "text"
  },
  "ackRequired": true
}
```

### 14.2. `CallSnapshot` (Event Recovery & State Sync)
- **Mục đích**: Được WebSocket trả về khi kết nối lại (reconnect) để khôi phục toàn bộ trạng thái cuộc gọi hiện hành.
- `CallSnapshot`: `{ callId, status, participants: [CallParticipantSnapshot], startedAt, mediaSettings: MediaSettingsSnapshot }`
  - `CallParticipantSnapshot`: `{ id, userId, username, avatarUrl, isMuted, isVideoOff, isScreenSharing, connectionQuality, joinedAt, isHost }`
  - `MediaSettingsSnapshot`: `{ videoCodec: String, audioCodec: String, simulcastLayers: Int }`

### 14.3. Mediasoup SFU & WebRTC Client Models
Được decode trong quá trình khởi tạo phòng gọi đa bên qua Selective Forwarding Unit (SFU):
- `MediasoupTransportOptions`: `{ id, iceParameters: IceParameters, iceCandidates: [MediasoupIceCandidate], dtlsParameters: DtlsParameters, sctpParameters: SctpParameters? }`
- `IceParameters`: `{ usernameFragment: String, password: String, iceLite: Bool? }`
- `MediasoupIceCandidate`: `{ foundation, priority, ip, protocol, port, type, tcpType? }`
- `DtlsParameters`: `{ role, fingerprints: [DtlsFingerprint] }`
- `RtpParameters`: `{ mid, codecs: [RtpCodecParameters], headerExtensions: [RtpHeaderExtensionParameters], encodings: [RtpEncodingParameters], rtcp: RtcpParameters }`
- `RtpCapabilities`: `{ codecs: [RtpCodecParameters], headerExtensions: [RtpHeaderExtensionParameters] }`
- `ProducerInfo` / `ConsumerInfo`: `{ id, producerId, kind, rtpParameters, type, paused, closed }`
- `ProducerStats` / `ConsumerStats`: Số liệu thống kê thời gian thực về `bitrate`, `packetLoss`, `roundTripTime`, `jitter`.

---

## 3. Bảng Ánh Xạ Tổng Thể (Clean Architecture Mapping Matrix)

Bảng đối chiếu nhanh toàn bộ DTOs decode từ Backend sang Clean Domain Entities:

| Tên DTO / Decode Model | Nhóm Nghiệp Vụ | File Nguồn | Domain Entity Đích | Mapper Xử Lý |
|---|---|---|---|---|
| `UserDTO` | User / Profile | [UserDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/UserDTO.swift) | `User` | `UserMapper.toEntity` |
| `UserSettingsDTO` | Cài đặt | [UserSettingsDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/UserSettingsDTO.swift) | `UserSettings` | `UserSettingsMapper.toEntity` |
| `PostDTO` | Bài viết | [PostDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/PostDTO.swift) | `Post` | `PostMapper.toEntity` |
| `MediaItemDTO` | Carousel Media | [PostDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/PostDTO.swift) | `PostMediaItem` | `PostMapper.toMediaItemEntity` |
| `ReelDTO` | Video Reels | [ReelDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/ReelDTO.swift) | `Reel` | `ReelMapper.toEntity` |
| `CommentDTO` | Bình luận | [CommentDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/CommentDTO.swift) | `Comment` | `CommentMapper.toEntity` |
| `StoryDTO` | Tin Story | [StoryDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/StoryDTO.swift) | `Story` | `StoryMapper.toEntity` |
| `StoryItemDTO` | Media Story | [StoryDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/StoryDTO.swift) | `StoryMediaItem` | `StoryMapper.toItemEntity` |
| `StoryReplyDTO` | Phản hồi Story | [StoryDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/StoryDTO.swift) | `StoryReply` | `StoryMapper.toStoryReply` |
| `ConversationDTO` | Hội thoại | [MessageDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/MessageDTO.swift) | `Conversation` | `MessageMapper.toConversation` |
| `ConversationMemberDTO` | Thành viên | [MessageDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/MessageDTO.swift) | `User` | `MessageMapper.toMemberUser` |
| `MessageDTO` | Tin nhắn | [MessageDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/MessageDTO.swift) | `Message` | `MessageMapper.toMessage` |
| `GroupDetailsDTO` | Chi tiết nhóm | [MessageDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/MessageDTO.swift) | `GroupDetails` | `MessageMapper.toGroupDetails` |
| `NotificationDTO` | Thông báo | [NotificationDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/NotificationDTO.swift) | `AppNotification` | `NotificationMapper.toEntity` |
| `CallDTO` | Cuộc gọi | [CallDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/CallDTO.swift) | `Call` | `CallMapper.toEntity` |
| `ReportDTO` | Báo cáo vi phạm | [ReportDTO.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DTOs/ReportDTO.swift) | `Report` | `ReportMapper.toEntity` |
| `PresignedURLDTO` | Upload S3 | [RemoteUploadDataSource.swift](file:///Users/tomthecat/Instagram-SwiftUI/Data/DataSources/Remote/RemoteUploadDataSource.swift) | `UploadResult` | Trực tiếp trong DataSource |
| `TusUploadInfo` | TUS Resumable | [TusUseCases.swift](file:///Users/tomthecat/Instagram-SwiftUI/Domain/UseCases/Upload/TusUseCases.swift) | `TusUploadProgress` | UseCase domain logic |
| `WSEnvelope` | Realtime WS | [WebSocketService.swift](file:///Users/tomthecat/Instagram-SwiftUI/Core/WebSocket/WebSocketService.swift) | `WebSocketIncomingMessage` | `WebSocketMessageHandler` |

---

> **Tài liệu tham khảo liên quan**:
> - [Documentations/API_RESPONSES.md](file:///Users/tomthecat/Instagram-SwiftUI/Documentations/API_RESPONSES.md): Danh mục đầy đủ 100+ endpoints và JSON mẫu chi tiết từ Backend v2.0.
> - [Docs/DataParsingAndThreadingGuide.md](file:///Users/tomthecat/Instagram-SwiftUI/Docs/DataParsingAndThreadingGuide.md): Cẩm nang chi tiết về luồng parse dữ liệu và đa luồng bảo vệ 60/120 FPS.
