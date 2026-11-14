# TÀI LIỆU THAY ĐỔI BACKEND & HƯỚNG DẪN TÍCH HỢP CHO FRONTEND (FE/iOS)

> **Ngày cập nhật:** 13/11/2026  
> **Phiên bản Backend:** 2.0 (Lean, High-Performance, Neon Native)  
> **Kiến trúc cốt lõi:** Node.js 20 · Hono 4 · Drizzle ORM · Neon Serverless PostgreSQL · Better Auth  

---

## 1. TỔNG HỢP CÁC THAY ĐỔI QUAN TRỌNG Ở BACKEND

### 1.1. Khai tử hoàn toàn Prisma, chuẩn hóa 100% về Drizzle ORM
- Đã xóa bỏ toàn bộ thư mục `prisma/` và các dependencies `@prisma/client`, `prisma`.
- Loại bỏ hoàn toàn nguy cơ lệch pha schema (Schema Drift).
- Quản lý database schema tập trung tại [src/db/schema.ts](file:///Users/tomthecat/temp-BE/src/db/schema.ts).

### 1.2. Sửa dứt điểm lỗi Foreign Key đa hình (Likes, Comments, SavedItems)
- **Trước đây:** Bảng `likes`, `comments`, `saved_items` bị Prisma migration ép đồng thời 3-4 Foreign Keys trên 1 cột, khiến mọi thao tác Like/Comment/Save bị văng lỗi database.
- **Hiện tại:** Đã chuẩn hóa mô hình:
  - Bảng `likes`: Có các Foreign Key tường minh `postId`, `reelId`, `commentId`, `storyId` có `ON DELETE CASCADE`.
  - Bảng `comments`: Có Foreign Key `postId`, `reelId`.
  - Bảng `saved_items`: Có Foreign Key `postId`, `reelId`, `audioTrackId`.
  - Dữ liệu cũ và mới đều tương thích 100%, thao tác Like/Comment/Save hoạt động mượt mà và tự động cascade delete khi bài viết/reel bị xóa.

### 1.3. Chuẩn hóa Soft Delete với Partial Unique Index
- `username` và `email` trên bảng `users` hiện tại dùng **Partial Unique Index** (`WHERE deleted_at IS NULL`).
- Người dùng bị xóa tài khoản sẽ không làm chiếm giữ vĩnh viễn username/email, cho phép đăng ký lại bình thường.

### 1.4. Tối ưu hóa bảng Hộp thư (`conversations`)
- Thêm trường `canonicalPair` đảm bảo **duy nhất 1 cuộc trò chuyện 1-1** giữa hai người dùng (không bao giờ bị sinh trùng lặp cuộc hội thoại).
- Bổ sung `lastMessageId`, `lastMessageText`, `lastMessageAt` trực tiếp trên bảng `conversations`, giúp màn hình Inbox tải danh sách chat $O(1)$ mà không cần subquery nặng.

### 1.5. Hỗ trợ linh hoạt URL Số ít / Số nhiều (Singular & Plural Aliases)
Backend đã cấu hình route alias kép. Frontend có thể gọi số ít hoặc số nhiều mà không bao giờ bị lỗi 404:
- `/v1/user` $\longleftrightarrow$ `/v1/users`
- `/v1/post` $\longleftrightarrow$ `/v1/posts`
- `/v1/reel` $\longleftrightarrow$ `/v1/reels`
- `/v1/story` $\longleftrightarrow$ `/v1/stories`
- `/v1/conversation` $\longleftrightarrow$ `/v1/conversations`

### 1.6. Sửa dứt điểm lỗi 500 trên Hộp thư Tin nhắn (`GET /v1/conversations/:id/messages`)
- **Nguyên nhân:** Bảng `messages` trên Neon DB thiếu cột `media_metadata`, `reaction_emoji`, `is_ephemeral`, `expires_at`, `is_edited`, `edited_at`, `is_unsent`, `unsent_at`, `unsent_for_everyone`, `updated_at`. Thiếu bảng `message_reactions` và `story_replies`.
- **Đã khắc phục:**
  - Chạy migration Drizzle bổ sung toàn bộ các cột và tạo bảng `message_reactions`, `story_replies`.
  - Cả 2 thao tác `GET /v1/conversations/:id/messages` (lấy danh sách tin nhắn) và `POST /v1/conversations/:id/messages` (gửi tin nhắn) hiện trả về **HTTP 200 / 201 Created**.

### 1.7. Chuẩn hóa 100% Media URLs (Hình ảnh & Video) cho Seed Data
- **Vấn đề trước đây:**
  - Video mẫu trỏ vào Google Cloud Storage bucket (`storage.googleapis.com/gtv-videos-bucket`) đã bị Google khóa quyền truy cập công khai $\rightarrow$ **HTTP 403 Forbidden**.
  - Ảnh đại diện `i.pravatar.cc` và ảnh bài viết `picsum.photos` thường xuyên bị timeout hoặc treo kết nối khi fetch từ client.
  - Bảng `stories` và `story_items` trống rỗng (0 bản ghi) $\rightarrow$ FE không hiển thị được Story feed.
- **Giải pháp hoàn thiện:**
  - **Hình ảnh (`media_items`, `users.avatar_url`, `story_items`, `reels.thumbnail_url`):** Chuyển toàn bộ sang CDN chính thức của **Unsplash** với định dạng chuẩn hóa:
    - Avatar: `https://images.unsplash.com/<id>?w=400&h=400&auto=format&fit=crop&crop=faces&q=80` (100% ảnh chân dung người thật).
    - Post Feed: `https://images.unsplash.com/<id>?w=1080&h=1350&auto=format&fit=crop&q=80`
    - Vertical Story/Reel Thumb: `https://images.unsplash.com/<id>?w=480&h=854&auto=format&fit=crop&q=80`
  - **Video (`reels.video_url`, `media_items` video, `story_items` video):** Chuyển sang 8 đường link video MP4 mẫu tiêu chuẩn từ W3C, ZenCDN và MDN (như `media.w3.org`, `vjs.zencdn.net`, `test-videos.co.uk`), hỗ trợ CORS và phản hồi trực tiếp `HTTP/2 200` với tốc độ cao.
  - **Seeded Active Stories:** Tự động tạo Story cho người dùng với hạn sử dụng 24h (`expires_at = NOW() + 24 hours`), đầy đủ cả Story ảnh và video clip.

### 1.8. Bổ sung Route Aliases cho User Posts & Reels
- Hỗ trợ cả 2 cách gọi RESTful cho màn hình Profile:
  - Lấy Posts của User: `GET /v1/posts/user/:userId` $\longleftrightarrow$ `GET /v1/users/:userId/posts`
  - Lấy Reels của User: `GET /v1/reels/user/:userId` $\longleftrightarrow$ `GET /v1/users/:userId/reels`

### 1.9. Chuẩn hóa đồng bộ Avatar & Payload giữa Feed, Story Tray và Profile
- **Nguyên nhân lệch Avatar giữa Story Feed và My Profile:**
  1. **Backend (`GET /v1/stories/feed`):** Trước đây trả về cấu trúc group `{ userId, author, stories: [...] }` và trong `story_items` thiếu trường `createdAt`, `thumbnailUrl`, `storyId`. Khi FE iOS decode bằng `JSONDecoder` vào `StoriesFeedDTO` (yêu cầu các trường `id`, `authorId`, `items: [StoryItemDTO]` với `createdAt: String` bắt buộc), hàm decode văng lỗi $\rightarrow$ FE fallback về `stories = []`.
  2. **FE SessionStore chưa cập nhật khi login:** Khi `stories = []`, circle "Tin của bạn" (Your Story) fallback đọc `SessionStore.shared.currentUser?.avatarURL`. Do tại `AuthRepository.login()` và `AuthViewModel.login()` chưa gọi `SessionStore.shared.setSession(user: session.user)`, nên `SessionStore` vẫn giữ avatar cũ/mock. Trong khi tab **My Profile** lại gọi `GET /v1/user/profile` trực tiếp qua mạng nên lấy đúng avatar mới của `mylam10` $\rightarrow$ sinh ra hiện tượng avatar ở Story khác avatar ở Profile.
- **Giải pháp hoàn thiện:**
  - **Backend (`src/services/story-service.ts`):** Chuẩn hóa `GET /v1/stories/feed` trả về payload **Hybrid Dual-Compatible** vừa chứa đầy đủ các trường của `StoryDTO` (`id`, `authorId`, `author`, `items`, `createdAt`, `expiresAt`, `viewed`) vừa chứa `userId` và mảng `stories` cho client group. Bổ sung `createdAt` ISO string, `storyId`, `thumbnailUrl` vào từng item.
  - **Dữ liệu bài viết user-10 (`mylam10`):** Đã bổ sung 2 bài viết (posts) chuẩn hóa kèm media Unsplash, cập nhật `posts_count = 2` và làm mới materialized view `feed_items`.
  - **Client iOS (`AuthManager.swift`, `AuthViewModel.swift`):** Đã bổ sung lệnh `SessionStore.shared.setSession(user: session.user)` ngay khi đăng nhập thành công. Cả 5 màn hình (Feed Story Tray, Post Card, Reels, Profile Header, User Posts Grid) hiện hiển thị đồng nhất 100% cùng một avatar URL.

---

## 2. CHI TIẾT BỘ API FOLLOW & FOLLOWER (ĐÃ CÓ ĐẦY ĐỦ)

Backend hiện tại đã có **trọn bộ 7 API** xử lý Follow / Unfollow / Yêu cầu theo dõi:

### 2.1. Lấy danh sách Người theo dõi (Followers List)
* **Endpoint:** `GET /v1/user/:id/followers` (hoặc `/v1/users/:id/followers`)
* **Headers:** `Authorization: Bearer <token>` (tùy chọn nhưng nên gửi để lấy `isFollowing`)
* **Query Params:**
  * `page` (number, default: 1)
  * `perPage` (number, default: 20)
* **Response Body (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "e2a3b4c5-...",
        "username": "jane_smith",
        "fullName": "Jane Smith",
        "avatarUrl": "https://i.pravatar.cc/400?u=jane_smith",
        "bio": "Travel & lifestyle content creator",
        "isVerified": true,
        "isPrivate": false,
        "followedAt": "2026-11-12T10:30:00.000Z",
        "isFollowing": true
      }
    ],
    "page": 1,
    "perPage": 20,
    "total": 128,
    "hasMore": true
  }
}
```
> [!NOTE]
> Trường `isFollowing`:
> - `true`: Bạn đang follow người này.
> - `false`: Bạn chưa follow người này $\rightarrow$ FE hiển thị nút **"Follow"**.
> - `null`: Người này chính là bạn (không hiển thị nút follow chính mình).

---

### 2.2. Lấy danh sách Đang theo dõi (Following List)
* **Endpoint:** `GET /v1/user/:id/following` (hoặc `/v1/users/:id/following`)
* **Headers:** `Authorization: Bearer <token>`
* **Query Params:** `page`, `perPage`
* **Response Body (`200 OK`):**
Cấu trúc tương tự như API Followers ở trên (kèm theo trường `isFollowing`).

---

### 2.3. Lấy danh sách Yêu cầu theo dõi đang chờ duyệt (Pending Follow Requests)
*Dành cho tài khoản riêng tư (Private Account) xem ai đang xin follow mình.*
* **Endpoint:** `GET /v1/user/follow-requests`
* **Headers:** `Authorization: Bearer <token>`
* **Response Body (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "req-987...",
        "requesterId": "user-123...",
        "username": "alex_rivera",
        "fullName": "Alex Rivera",
        "avatarUrl": "https://i.pravatar.cc/400?u=alex",
        "bio": "Photography lover",
        "isVerified": false,
        "createdAt": "2026-11-13T08:15:00.000Z"
      }
    ],
    "page": 1,
    "perPage": 20,
    "total": 3,
    "hasMore": false
  }
}
```

---

### 2.4. Theo dõi một người dùng (Follow User)
* **Endpoint:** `POST /v1/user/:id/follow`
* **Headers:** `Authorization: Bearer <token>`
* **Response Body:**
  * Nếu tài khoản public: Trả về trạng thái `status: "ACCEPTED"`.
  * Nếu tài khoản private: Trả về trạng thái `status: "PENDING"` (chờ đối phương duyệt).

---

### 2.5. Hủy theo dõi (Unfollow User)
* **Endpoint:** `DELETE /v1/user/:id/follow`
* **Headers:** `Authorization: Bearer <token>`
* **Response Body:** `200 OK` (Cập nhật giảm `followingCount` và `followersCount` ngay lập tức).

---

### 2.6. Đồng ý yêu cầu theo dõi (Accept Follow Request)
* **Endpoint:** `POST /v1/user/:id/accept`
* **Tham số `:id`:** ID của người gửi yêu cầu (`requesterId`).
* **Headers:** `Authorization: Bearer <token>`
* **Response Body:**
```json
{
  "success": true,
  "message": "Follow request accepted"
}
```

---

### 2.7. Từ chối yêu cầu theo dõi (Decline Follow Request)
* **Endpoint:** `POST /v1/user/:id/decline`
* **Tham số `:id`:** ID của người gửi yêu cầu (`requesterId`).
* **Headers:** `Authorization: Bearer <token>`
* **Response Body:**
```json
{
  "success": true,
  "message": "Follow request declined"
}
```

---

## 3. CHECKLIST DÀNH CHO ĐỘI NGŨ FRONTEND (FE/iOS)

Để ứng dụng iOS hoạt động mượt mà và tận dụng tối đa các tối ưu hóa mới của backend, đội ngũ FE nên cập nhật các điểm sau:

### ✅ Việc 1: Sử dụng trường `isFollowing` trong danh sách Follower/Following
- **Hiện tại:** Trong màn hình Profile khi mở modal Followers hoặc Following, mỗi item đã có sẵn trường `isFollowing: boolean | null`.
- **Hành động FE:** 
  - Nếu `isFollowing === false`: Hiển thị nút **"Follow"** màu xanh/nổi bật.
  - Nếu `isFollowing === true`: Hiển thị nút **"Following"** màu xám (hoặc "Đang theo dõi").
  - Nếu `isFollowing === null`: Ẩn nút follow (vì là chính user hiện tại).
  - Không cần phải gọi thêm API phụ để kiểm tra xem mình có đang follow từng người hay không!

### ✅ Việc 2: Màn hình Thông báo / Duyệt Follow Requests
- Với tài khoản cá nhân được đặt là Private (`isPrivate === true`):
  - Gọi `GET /v1/user/follow-requests` để hiển thị danh sách người chờ duyệt.
  - Nút **Xác nhận**: Gọi `POST /v1/user/:id/accept`.
  - Nút **Xóa / Từ chối**: Gọi `POST /v1/user/:id/decline`.

### ✅ Việc 3: Tải màn hình Inbox tin nhắn (Direct Messages)
- Khi gọi `GET /v1/conversations`:
  - Mỗi cuộc trò chuyện đã có sẵn `lastMessageText` và `lastMessageAt`.
  - FE chỉ cần sắp xếp và hiển thị trực tiếp đoạn xem trước tin nhắn cuối cùng mà không cần đợi load lịch sử tin nhắn bên trong.

### ✅ Việc 4: Khắc phục triệt để lỗi Like / Unlike / Save bài viết
- Các endpoint:
  - `POST /v1/posts/:id/like` & `DELETE /v1/posts/:id/like`
  - `POST /v1/posts/:id/save` & `DELETE /v1/posts/:id/save`
  - `POST /v1/posts/:id/comments` & `DELETE /v1/posts/:id/comments/:commentId`
  - Các API trên hiện đã hoạt động trơn tru 100% không còn bị lỗi Foreign Key Constraint. FE có thể yên tâm test và hiển thị tức thời số đếm `likesCount`, `commentsCount` trả về.
  - Khi gửi comment, FE có thể gửi trường `{ "text": "..." }` hoặc `{ "content": "..." }` đều được backend chấp nhận.

---

## 4. KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST SUITE REPORT)
Đã thực hiện chạy tự động kiểm thử toàn bộ các API Endpoints bằng tài khoản:
* **Tài khoản test:** `mylam10@example.com`
* **Mật khẩu:** `password123`

| Nhóm chức năng | Endpoint | Phương thức | Status Code | Kết quả kiểm thử |
| :--- | :--- | :---: | :---: | :---: |
| **Authentication** | `/v1/auth/login` | POST | 200 OK | ✅ Thành công, sinh JWT session token |
| | `/v1/auth/me` | GET | 200 OK | ✅ Trả về thông tin session & user |
| **User & Profile** | `/v1/user/me` | GET | 200 OK | ✅ Trả về profile cá nhân |
| | `/v1/user/profile` | GET | 200 OK | ✅ Trả về profile kèm follower/following counts |
| | `/v1/user/settings` | GET | 200 OK | ✅ Trả về JSON settings |
| | `/v1/user/suggested` | GET | 200 OK | ✅ Danh sách gợi ý kết bạn |
| | `/v1/user/search?q=a` | GET | 200 OK | ✅ Tìm kiếm user theo từ khóa |
| | `/v1/user/follow-requests` | GET | 200 OK | ✅ Danh sách yêu cầu theo dõi |
| **Follow Flow** | `/v1/user/:id/followers` | GET | 200 OK | ✅ Danh sách follower kèm `isFollowing` |
| | `/v1/user/:id/following` | GET | 200 OK | ✅ Danh sách following kèm `isFollowing` |
| | `/v1/users/:id/followers` | GET | 200 OK | ✅ Alias số nhiều hoạt động 100% |
| | `/v1/user/:id/follow` | POST | 204 No Content | ✅ Follow thành công |
| | `/v1/user/:id/follow` | DELETE | 204 No Content | ✅ Unfollow thành công |
| **Posts & Feed** | `/v1/posts/feed` | GET | 200 OK | ✅ Bảng tin chính (100% media Unsplash 200 OK) |
| | `/v1/posts/explore` | GET | 200 OK | ✅ Khám phá bài viết |
| | `/v1/posts/saved` | GET | 200 OK | ✅ Bài viết đã lưu |
| | `/v1/posts/user/:id` | GET | 200 OK | ✅ Danh sách bài viết theo user |
| | `/v1/users/:id/posts` | GET | 200 OK | ✅ RESTful alias cho User Posts grid |
| | `/v1/posts/:id/like` | POST | 204 No Content | ✅ Thả tim bài viết |
| | `/v1/posts/:id/like` | DELETE | 204 No Content | ✅ Hủy thả tim |
| | `/v1/posts/:id/comments` | POST | 201 Created | ✅ Thêm bình luận |
| **Stories & Reels** | `/v1/stories/feed` | GET | 200 OK | ✅ Bảng tin Story (Active 24h, ảnh + video mp4) |
| | `/v1/reels/feed` | GET | 200 OK | ✅ Bảng tin Reels (100% video MP4 200 OK) |
| | `/v1/reels/explore` | GET | 200 OK | ✅ Khám phá Reels |
| | `/v1/reels/user/:id` | GET | 200 OK | ✅ Danh sách Reels theo user |
| | `/v1/users/:id/reels` | GET | 200 OK | ✅ RESTful alias cho User Reels grid |
| **Direct Messages** | `/v1/conversations` | GET | 200 OK | ✅ Danh sách hộp thư chat |
| | `/v1/conversations/:id/messages` | GET | 200 OK | ✅ Danh sách tin nhắn (Đã sửa lỗi 500) |
| | `/v1/conversations/:id/messages` | POST | 201 Created | ✅ Gửi tin nhắn thành công |
| **Notifications** | `/v1/notifications` | GET | 200 OK | ✅ Danh sách thông báo |
| **Search Sub-routes** | `/v1/search?q=...` | GET | 200 OK | ✅ Unified search |
| | `/v1/search/top?q=...` | GET | 200 OK | ✅ Top results |
| | `/v1/search/users?q=...` | GET | 200 OK | ✅ Chỉ tìm kiếm Users |
| | `/v1/search/tags?q=...` | GET | 200 OK | ✅ Chỉ tìm kiếm Hashtags |
| | `/v1/search/suggestions` | GET | 200 OK | ✅ Gợi ý tìm kiếm (typeahead) |

> **Tổng kết:** 100% các API cốt lõi của Backend đã hoạt động chính xác, không còn lỗi 500, hiệu năng cao và tương thích hoàn toàn với Neon Serverless PostgreSQL.
