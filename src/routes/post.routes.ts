import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware, getCurrentUser } from "../middleware/auth";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { eq, and, desc, asc, count, sql, inArray, lt, gt, not, isNull, or, gte, exists } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createFeedService, FeedService } from "../services/feed-service";
import { createExploreService } from "../services/explore-service";
import {
  getComments,
  getReplies,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
  reportComment,
} from "../services/comment-service";

// ============================================================================
// Validation Schemas
// ============================================================================

const createPostSchema = z.object({
  caption: z.string().max(2200).optional(),
  locationName: z.string().max(200).optional(),
  locationId: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  audience: z.string().optional().default("PUBLIC"),
  closeFriendsOnly: z.boolean().default(false),
  allowComments: z.boolean().optional(),
  allowLikes: z.boolean().optional(),
  mediaIds: z.array(z.string()).optional(),
  media: z.array(
    z.object({
      url: z.string().url(),
      type: z.string().default("IMAGE"),
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.number().optional(),
      sortOrder: z.number().optional(),
      pendingUploadId: z.string().uuid().optional(),
    })
  ).min(1).max(10).optional(),
});

function toDecimalString(num?: number): string | undefined {
  return num !== undefined ? num.toString() : undefined;
}

const updatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  locationName: z.string().max(200).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  audience: z.enum(["PUBLIC", "FOLLOWERS", "CLOSE_FRIENDS"]).optional(),
  closeFriendsOnly: z.boolean().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  content: z.string().min(1).max(1000).optional(),
  parentId: z.string().optional(),
}).refine((data) => data.text || data.content, {
  message: "text or content is required",
});

const reportSchema = z.object({
  reason: z.enum([
    "SPAM", "HATE_SPEECH", "HARASSMENT", "VIOLENCE", "NUDITY",
    "SELF_HARM", "MISINFORMATION", "SCAM", "IMPERSONATION", "COPYRIGHT", "OTHER"
  ]),
  description: z.string().optional(),
});

// ============================================================================
// Helpers
// ============================================================================

function getCursorPagination(c: any) {
  const cursor = c.req.query("cursor");
  const perPage = Math.min(Number(c.req.query("perPage")) || 20, 50);
  return { cursor, perPage };
}

function getPagination(c: any) {
  const page = Number(c.req.query("page")) || 1;
  const perPage = Math.min(Number(c.req.query("perPage")) || 20, 50);
  return { page, perPage, offset: (page - 1) * perPage };
}

// ============================================================================
// Router Setup
// ============================================================================

const postRouter = new Hono();
postRouter.use("*", authMiddleware);

// ============================================================
// FEED ENDPOINTS (using FeedService with ranking algorithm)
// ============================================================

postRouter.get("/feed", async (c) => {
  const user = getCurrentUser(c);
  const { cursor, perPage } = getCursorPagination(c);

  const feedService = createFeedService(user.id);
  const result = await feedService.getFeed(cursor, perPage);

  // Fetch media items for all posts in the feed
  const postIds = result.items.map((item) => item.postId);
  const mediaItems = postIds.length > 0
    ? await db.query.mediaItems.findMany({
        where: and(
          eq(schema.mediaItems.mediaableType, "post"),
          inArray(schema.mediaItems.mediaableId, postIds)
        ),
        orderBy: asc(schema.mediaItems.sortOrder),
      })
    : [];

  // Group media items by post ID
  const mediaByPostId = new Map<string, typeof mediaItems>();
  for (const media of mediaItems) {
    if (!mediaByPostId.has(media.mediaableId)) {
      mediaByPostId.set(media.mediaableId, []);
    }
    mediaByPostId.get(media.mediaableId)!.push(media);
  }

  const feedItems = result.items.map((item) => {
    const postMediaItems = mediaByPostId.get(item.postId) || [];
    return {
      id: item.postId,
      authorId: item.authorId,
      caption: item.caption,
      locationName: item.locationName,
      locationLat: item.locationLat,
      locationLng: item.locationLng,
      likesCount: item.likesCount,
      commentsCount: item.commentsCount,
      sharesCount: item.sharesCount,
      savesCount: item.savesCount,
      viewsCount: item.viewsCount,
      isSponsored: item.isSponsored,
      sponsorUserId: item.sponsorUserId,
      audience: item.audience,
      closeFriendsOnly: item.closeFriendsOnly,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      author: {
        id: item.authorId,
        username: item.username,
        fullName: item.fullName,
        avatarUrl: item.avatarUrl,
        isVerified: item.isVerified,
        isPrivate: item.isPrivate,
      },
      mediaItems: postMediaItems.map((mi) => ({
        id: mi.id,
        url: mi.url,
        thumbnailUrl: mi.thumbnailUrl,
        type: mi.type,
        width: mi.width,
        height: mi.height,
        duration: mi.duration ? parseFloat(mi.duration) : null,
        sortOrder: mi.sortOrder,
      })),
      user: {
        id: item.authorId,
        username: item.username,
        displayName: item.fullName || item.username,
        avatarUrl: item.avatarUrl || null,
        isVerified: item.isVerified,
      },
      media: postMediaItems.map((m) => ({
        id: m.id,
        type: (m.type || "image").toLowerCase(),
        url: m.url,
        thumbnailUrl: m.thumbnailUrl || m.url,
        width: m.width || 1080,
        height: m.height || 1080,
      })),
      isLiked: false,
      isSaved: false,
    };
  });

  const cursorStr = result.nextCursor ? feedService.getCursorString(result.nextCursor) : null;

  return c.json({
    success: true,
    data: {
      items: feedItems,
      nextCursor: cursorStr,
      hasMore: result.hasMore,
    },
  });
});

// ============================================================
// EXPLORE ENDPOINT (using ExploreService)
// ============================================================

postRouter.get("/explore", async (c) => {
  const user = getCurrentUser(c);
  const { cursor, perPage } = getCursorPagination(c);

  const exploreService = createExploreService(user.id);
  const result = await exploreService.getExploreFeed(cursor, perPage);

  // Fetch media items for all posts in the explore feed
  const postIds = result.items.map((item) => item.postId);
  const mediaItems = postIds.length > 0
    ? await db.query.mediaItems.findMany({
        where: and(
          eq(schema.mediaItems.mediaableType, "post"),
          inArray(schema.mediaItems.mediaableId, postIds)
        ),
        orderBy: asc(schema.mediaItems.sortOrder),
      })
    : [];

  // Group media items by post ID
  const mediaByPostId = new Map<string, typeof mediaItems>();
  for (const media of mediaItems) {
    if (!mediaByPostId.has(media.mediaableId)) {
      mediaByPostId.set(media.mediaableId, []);
    }
    mediaByPostId.get(media.mediaableId)!.push(media);
  }

  return c.json({
    success: true,
    data: {
      items: result.items.map((item) => {
        const postMediaItems = mediaByPostId.get(item.postId) || [];
        return {
          id: item.postId,
          authorId: item.authorId,
          caption: item.caption,
          locationName: item.locationName,
          locationLat: item.locationLat,
          locationLng: item.locationLng,
          likesCount: item.likesCount,
          commentsCount: item.commentsCount,
          sharesCount: item.sharesCount,
          savesCount: item.savesCount,
          viewsCount: item.viewsCount,
          isSponsored: item.isSponsored,
          sponsorUserId: item.sponsorUserId,
          audience: item.audience,
          closeFriendsOnly: item.closeFriendsOnly,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          author: {
            id: item.authorId,
            username: item.username,
            fullName: item.fullName,
            avatarUrl: item.avatarUrl,
            isVerified: item.isVerified,
            isPrivate: item.isPrivate,
          },
          mediaItems: postMediaItems.map((mi) => ({
            id: mi.id,
            url: mi.url,
            thumbnailUrl: mi.thumbnailUrl,
            type: mi.type,
            width: mi.width,
            height: mi.height,
            duration: mi.duration ? parseFloat(mi.duration) : null,
            sortOrder: mi.sortOrder,
          })),
          isLiked: false,
          isSaved: false,
          exploreSource: item.source,
          exploreReason: item.reason,
        };
      }),
      nextCursor: result.nextCursor ? exploreService.getCursorString(result.nextCursor) : null,
      hasMore: result.hasMore,
      sections: result.sections,
    },
  });
});

// Explore sections endpoint for grid layout
postRouter.get("/explore/sections", async (c) => {
  const user = getCurrentUser(c);
  const exploreService = createExploreService(user.id);
  const sections = await exploreService.getExploreSections();

  return c.json({
    success: true,
    data: { sections },
  });
});

// ============================================================
// SAVED POSTS FEED
// ============================================================

postRouter.get("/saved", async (c) => {
  const user = getCurrentUser(c);
  const { cursor, perPage } = getCursorPagination(c);

  const whereConditions = [eq(schema.savedItems.userId, user.id)];
  if (cursor) {
    whereConditions.push(lt(schema.savedItems.createdAt, new Date(cursor)));
  }

  const postsList = await db
    .select({
      id: schema.posts.id,
      authorId: schema.posts.authorId,
      caption: schema.posts.caption,
      locationName: schema.posts.locationName,
      locationLat: schema.posts.locationLat,
      locationLng: schema.posts.locationLng,
      likesCount: schema.posts.likesCount,
      commentsCount: schema.posts.commentsCount,
      sharesCount: schema.posts.sharesCount,
      savesCount: schema.posts.savesCount,
      viewsCount: schema.posts.viewsCount,
      isSponsored: schema.posts.isSponsored,
      sponsorUserId: schema.posts.sponsorUserId,
      audience: schema.posts.audience,
      closeFriendsOnly: schema.posts.closeFriendsOnly,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt,
      author: {
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        avatarUrl: schema.users.avatarUrl,
        isVerified: schema.users.isVerified,
      },
      mediaItems: sql`(SELECT json_agg(json_build_object('id', mi.id, 'url', mi.url, 'thumbnailUrl', mi.thumbnail_url, 'type', mi.type, 'width', mi.width, 'height', mi.height, 'duration', mi.duration, 'sortOrder', mi.sort_order) ORDER BY mi.sort_order) FROM media_items mi WHERE mi.mediaable_type = 'post' AND mi.mediaable_id = posts.id)`,
      savedAt: schema.savedItems.createdAt,
    })
    .from(schema.savedItems)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.savedItems.saveableId))
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .where(and(...whereConditions))
    .limit(perPage + 1)
    .orderBy(desc(schema.savedItems.createdAt));

  const hasMore = postsList.length > perPage;
  const items = hasMore ? postsList.slice(0, perPage) : postsList;
  const nextCursor = hasMore ? items[items.length - 1].savedAt.toISOString() : null;

  const postIds = items.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    postIds.length > 0 ? db.select({ likeableId: schema.likes.likeableId }).from(schema.likes).where(and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "POST"), inArray(schema.likes.likeableId, postIds))) : Promise.resolve([]),
    postIds.length > 0 ? db.select({ saveableId: schema.savedItems.saveableId }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.saveableType, "POST"), inArray(schema.savedItems.saveableId, postIds))) : Promise.resolve([]),
  ]);
  const likedSet = new Set(likes.map((l) => l.likeableId));
  const savedSet = new Set(saves.map((s) => s.saveableId));

  return c.json({
    success: true,
    data: {
      items: items.map((p) => ({
        ...p,
        author: { ...p.author, isFollowing: false },
        mediaItems: p.mediaItems || [],
        isLiked: likedSet.has(p.id),
        isSaved: true,
      })),
      nextCursor,
      hasMore,
    },
  });
});

// ============================================================
// USER POSTS GRID (with private account checks)
// ============================================================

postRouter.get("/user/:userId", async (c) => {
  const user = getCurrentUser(c);
  const targetId = c.req.param("userId");
  const { cursor, perPage } = getCursorPagination(c);

  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetId),
    columns: { id: true, isPrivate: true, username: true }
  });

  if (!targetUser) throw new HTTPException(404, { message: "User not found" });

  // Check private account access
  if (targetUser.isPrivate && targetId !== user.id) {
    const following = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, user.id),
        eq(schema.follows.followingId, targetId),
        eq(schema.follows.status, "ACCEPTED")
      )
    });
    if (!following) throw new HTTPException(403, { message: "This account is private" });
  }

  const whereConditions = [
    eq(schema.posts.authorId, targetId),
    isNull(schema.posts.deletedAt),
    isNull(schema.posts.archivedAt),
  ];

  if (cursor) {
    whereConditions.push(lt(schema.posts.createdAt, new Date(cursor)));
  }

  const postsList = await db
    .select({
      id: schema.posts.id,
      authorId: schema.posts.authorId,
      caption: schema.posts.caption,
      locationName: schema.posts.locationName,
      locationLat: schema.posts.locationLat,
      locationLng: schema.posts.locationLng,
      likesCount: schema.posts.likesCount,
      commentsCount: schema.posts.commentsCount,
      sharesCount: schema.posts.sharesCount,
      savesCount: schema.posts.savesCount,
      viewsCount: schema.posts.viewsCount,
      isSponsored: schema.posts.isSponsored,
      sponsorUserId: schema.posts.sponsorUserId,
      audience: schema.posts.audience,
      closeFriendsOnly: schema.posts.closeFriendsOnly,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt,
      author: {
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        avatarUrl: schema.users.avatarUrl,
        isVerified: schema.users.isVerified,
      },
      mediaItems: sql`(SELECT json_agg(json_build_object('id', mi.id, 'url', mi.url, 'thumbnailUrl', mi.thumbnail_url, 'type', mi.type, 'width', mi.width, 'height', mi.height, 'duration', mi.duration, 'sortOrder', mi.sort_order) ORDER BY mi.sort_order) FROM media_items mi WHERE mi.mediaable_type = 'post' AND mi.mediaable_id = posts.id)`,
    })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .where(and(...whereConditions))
    .limit(perPage + 1)
    .orderBy(desc(schema.posts.createdAt));

  const hasMore = postsList.length > perPage;
  const items = hasMore ? postsList.slice(0, perPage) : postsList;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  const postIds = items.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    postIds.length > 0 ? db.select({ likeableId: schema.likes.likeableId }).from(schema.likes).where(and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "POST"), inArray(schema.likes.likeableId, postIds))) : Promise.resolve([]),
    postIds.length > 0 ? db.select({ saveableId: schema.savedItems.saveableId }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.saveableType, "POST"), inArray(schema.savedItems.saveableId, postIds))) : Promise.resolve([]),
  ]);
  const likedSet = new Set(likes.map((l) => l.likeableId));
  const savedSet = new Set(saves.map((s) => s.saveableId));

  const isFollowing = targetId !== user.id && await db.query.follows.findFirst({
    where: and(
      eq(schema.follows.followerId, user.id),
      eq(schema.follows.followingId, targetId),
      eq(schema.follows.status, "ACCEPTED")
    )
  });

  return c.json({
    success: true,
    data: {
      items: items.map((p) => ({
        ...p,
        author: { ...p.author, isFollowing: !!isFollowing },
        mediaItems: p.mediaItems || [],
        isLiked: likedSet.has(p.id),
        isSaved: savedSet.has(p.id),
      })),
      nextCursor,
      hasMore,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        isPrivate: targetUser.isPrivate,
      },
    },
  });
});

// ============================================================
// SINGLE POST
// ============================================================

postRouter.get("/:id", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, postId),
    with: {
      author: true,
    },
  });

  if (!post) throw new HTTPException(404, { message: "Post not found" });

  if (post.author.isPrivate && post.authorId !== user.id) {
    const following = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, user.id),
        eq(schema.follows.followingId, post.authorId),
        eq(schema.follows.status, "ACCEPTED")
      )
    });
    if (!following) throw new HTTPException(403, { message: "This account is private" });
  }

  const [like, save, mediaItems] = await Promise.all([
    db.query.likes.findFirst({ where: and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "POST"), eq(schema.likes.likeableId, postId)) }),
    db.query.savedItems.findFirst({ where: and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.saveableType, "POST"), eq(schema.savedItems.saveableId, postId)) }),
    db.query.mediaItems.findMany({
      where: and(
        eq(schema.mediaItems.mediaableType, "post"),
        eq(schema.mediaItems.mediaableId, postId)
      ),
      orderBy: asc(schema.mediaItems.sortOrder),
    }),
  ]);

  const authorUser = post.author;
  const postUuid = post.id;
  const mappedMedia = mediaItems.map((m) => ({
    id: m.id,
    type: (m.type || "image").toLowerCase(),
    url: m.url,
    thumbnailUrl: m.thumbnailUrl || m.url,
    sortOrder: m.sortOrder ?? 0,
  }));

  const mappedLocation = post.locationName ? {
    id: post.locationId || post.id,
    name: post.locationName,
    latitude: post.locationLat ? Number(post.locationLat) : null,
    longitude: post.locationLng ? Number(post.locationLng) : null,
  } : null;

  return c.json({
    success: true,
    data: {
      post: {
        ...post,
        id: postUuid,
        user: {
          id: authorUser.id,
          username: authorUser.username,
          displayName: authorUser.fullName || authorUser.username,
          avatarUrl: authorUser.avatarUrl || null,
        },
        media: mappedMedia,
        location: mappedLocation,
        mediaItems,
        author: { ...authorUser, isFollowing: post.authorId !== user.id },
        isLiked: !!like,
        isSaved: !!save,
      },
    },
  });
});

// ============================================================
// POST CRUD
// ============================================================

postRouter.post("/", zValidator("json", createPostSchema), async (c) => {
  const user = getCurrentUser(c);
  const body = c.req.valid("json");
  const { caption, locationName, locationLat, locationLng, closeFriendsOnly } = body;
  const audience = (body.audience || "PUBLIC").toUpperCase();

  const [post] = await db.insert(schema.posts).values({
    authorId: user.id,
    caption,
    locationName: locationName || null,
    locationLat: locationLat !== undefined && locationLat !== null ? toDecimalString(locationLat) : null,
    locationLng: locationLng !== undefined && locationLng !== null ? toDecimalString(locationLng) : null,
    audience: audience === "FOLLOWERS" || audience === "CLOSE_FRIENDS" ? audience : "PUBLIC",
    closeFriendsOnly: closeFriendsOnly || false,
  }).returning();

  const mediaList = body.media || [];

  if (mediaList.length > 0) {
    await db.insert(schema.mediaItems).values(mediaList.map((m, index) => ({
      mediaableType: "post",
      mediaableId: post.id,
      url: m.url,
      thumbnailUrl: (m as any).thumbnailUrl || m.url,
      type: ((m.type || "IMAGE").toUpperCase()) as any,
      width: m.width || 1080,
      height: m.height || 1080,
      sortOrder: m.sortOrder ?? index,
    })));
  }

  await db.update(schema.users)
    .set({ postsCount: sql`${schema.users.postsCount} + 1` })
    .where(eq(schema.users.id, user.id));

  const pendingUploadIds = (body.media || []).filter((m) => m.pendingUploadId).map((m) => m.pendingUploadId!);
  if (pendingUploadIds.length > 0) {
    await db.update(schema.pendingUploads)
      .set({ confirmed: true })
      .where(inArray(schema.pendingUploads.id, pendingUploadIds));
  }

  // Invalidate feed for followers (new post)
  await FeedService.invalidateFollowersFeed(user.id, post.id);

  const [createdPost, mediaItems] = await Promise.all([
    db.query.posts.findFirst({
      where: eq(schema.posts.id, post.id),
      with: { author: true },
    }),
    db.query.mediaItems.findMany({
      where: and(
        eq(schema.mediaItems.mediaableType, "post"),
        eq(schema.mediaItems.mediaableId, post.id)
      ),
      orderBy: asc(schema.mediaItems.sortOrder),
    }),
  ]);

  const mappedMedia = mediaItems.map((m) => ({
    id: m.id,
    type: (m.type || "image").toLowerCase(),
    url: m.url,
    thumbnailUrl: m.thumbnailUrl || m.url,
    width: m.width || 1080,
    height: m.height || 1080,
  }));

  return c.json({
    success: true,
    data: {
      post: {
        ...createdPost!,
        userId: createdPost!.authorId,
        media: mappedMedia,
        mediaItems,
        location: {
          id: body.locationId || crypto.randomUUID(),
          name: createdPost!.locationName || "San Francisco, CA",
          latitude: Number(createdPost!.locationLat) || 37.7749,
          longitude: Number(createdPost!.locationLng) || -122.4194,
        },
        author: { ...createdPost!.author, isFollowing: false },
        isLiked: false,
        isSaved: false,
      },
    },
  }, 201);
});

postRouter.patch("/:id", zValidator("json", updatePostSchema), async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");
  const data = c.req.valid("json");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  if (post.authorId !== user.id) throw new HTTPException(403, { message: "Not authorized to edit this post" });

  const [updated] = await db.update(schema.posts).set({
    ...data,
    locationLat: toDecimalString(data.locationLat),
    locationLng: toDecimalString(data.locationLng),
    updatedAt: new Date(),
  }).where(eq(schema.posts.id, postId)).returning();

  return c.json({ success: true, data: { post: updated } });
});

postRouter.delete("/:id", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  if (post.authorId !== user.id) throw new HTTPException(403, { message: "Not authorized to delete this post" });

  await db.delete(schema.posts).where(eq(schema.posts.id, postId));
  await db.update(schema.users)
    .set({ postsCount: sql`${schema.users.postsCount} - 1` })
    .where(eq(schema.users.id, user.id));

  return c.body(null, 204);
});

postRouter.post("/:id/archive", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  if (post.authorId !== user.id) throw new HTTPException(403, { message: "Not authorized" });

  await db.update(schema.posts)
    .set({ archivedAt: new Date() })
    .where(eq(schema.posts.id, postId));

  return c.body(null, 204);
});

postRouter.delete("/:id/archive", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  if (post.authorId !== user.id) throw new HTTPException(403, { message: "Not authorized" });

  await db.update(schema.posts)
    .set({ archivedAt: null })
    .where(eq(schema.posts.id, postId));

  return c.body(null, 204);
});

// ============================================================
// POST INTERACTIONS
// ============================================================

postRouter.post("/:id/like", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const [post, mediaItems] = await Promise.all([
    db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
    }),
    db.query.mediaItems.findMany({
      where: and(
        eq(schema.mediaItems.mediaableType, "post"),
        eq(schema.mediaItems.mediaableId, postId)
      ),
      orderBy: asc(schema.mediaItems.sortOrder),
    }),
  ]);
  if (!post) {
    // Check if it is a reel
    const reel = await db.query.reels.findFirst({
      where: eq(schema.reels.id, postId),
    });
    if (reel) {
      const existing = await db.query.likes.findFirst({
        where: and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "REEL"), eq(schema.likes.likeableId, postId))
      });

      if (existing) {
        await db.delete(schema.likes).where(eq(schema.likes.id, existing.id));
        await db.update(schema.reels)
          .set({ likesCount: sql`GREATEST(0, ${schema.reels.likesCount} - 1)` })
          .where(eq(schema.reels.id, postId));

        const updatedReel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });

        return c.json({
          success: true,
          data: {
            isLiked: false,
            likesCount: updatedReel?.likesCount ?? Math.max(0, reel.likesCount - 1),
          },
        }, 200);
      }

      await db.insert(schema.likes).values({ userId: user.id, likeableType: "REEL", likeableId: postId });
      await db.update(schema.reels)
        .set({ likesCount: sql`${schema.reels.likesCount} + 1` })
        .where(eq(schema.reels.id, postId));

      if (reel.authorId !== user.id) {
        await db.insert(schema.notifications).values({
          recipientId: reel.authorId,
          actorId: user.id,
          type: "REEL_LIKE",
          referenceType: "reel",
          referenceId: postId,
          deepLink: `/reels/${postId}`,
          groupKey: `like:reel:${postId}`,
        });
      }

      const updatedReel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });

      return c.json({
        success: true,
        data: {
          isLiked: true,
          likesCount: updatedReel?.likesCount ?? (reel.likesCount + 1),
        },
      }, 200);
    }

    throw new HTTPException(404, { message: "Post not found" });
  }

  const existing = await db.query.likes.findFirst({
    where: and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "POST"), eq(schema.likes.likeableId, postId))
  });

  if (existing) {
    // Already liked -> Toggle to UNLIKE
    await db.delete(schema.likes).where(eq(schema.likes.id, existing.id));
    await db.update(schema.posts)
      .set({ likesCount: sql`GREATEST(0, ${schema.posts.likesCount} - 1)` })
      .where(eq(schema.posts.id, postId));

    const updatedPost = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });

    return c.json({
      success: true,
      data: {
        isLiked: false,
        likesCount: updatedPost?.likesCount ?? Math.max(0, post.likesCount - 1),
      },
    }, 200);
  }

  // Not liked yet -> Insert like
  await db.insert(schema.likes).values({ userId: user.id, likeableType: "POST", likeableId: postId });
  await db.update(schema.posts)
    .set({ likesCount: sql`${schema.posts.likesCount} + 1` })
    .where(eq(schema.posts.id, postId));

  if (post.authorId !== user.id) {
    await db.insert(schema.notifications).values({
      recipientId: post.authorId,
      actorId: user.id,
      type: "LIKE",
      referenceType: "post",
      referenceId: postId,
      previewText: post.caption ? post.caption.substring(0, 100) : undefined,
      thumbnailUrl: mediaItems[0]?.thumbnailUrl || mediaItems[0]?.url,
      deepLink: `/posts/${postId}`,
      groupKey: `like:post:${postId}`,
    });
  }

  const updatedPost = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });

  return c.json({
    success: true,
    data: {
      isLiked: true,
      likesCount: updatedPost?.likesCount ?? post.likesCount + 1,
    },
  }, 200);
});

const handleUnlikePost = async (c: any) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) {
    const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });
    if (reel) {
      const result = await db.delete(schema.likes)
        .where(and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "REEL"), eq(schema.likes.likeableId, postId)))
        .returning({ id: schema.likes.id });

      if (result.length > 0) {
        await db.update(schema.reels)
          .set({ likesCount: sql`GREATEST(0, ${schema.reels.likesCount} - 1)` })
          .where(eq(schema.reels.id, postId));
      }

      const updatedReel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });

      return c.json({
        success: true,
        data: {
          isLiked: false,
          likesCount: updatedReel?.likesCount ?? Math.max(0, reel.likesCount - (result.length > 0 ? 1 : 0)),
        },
      }, 200);
    }

    throw new HTTPException(404, { message: "Post not found" });
  }

  const result = await db.delete(schema.likes)
    .where(and(eq(schema.likes.userId, user.id), eq(schema.likes.likeableType, "POST"), eq(schema.likes.likeableId, postId)))
    .returning({ id: schema.likes.id });

  if (result.length > 0) {
    await db.update(schema.posts)
      .set({ likesCount: sql`GREATEST(0, ${schema.posts.likesCount} - 1)` })
      .where(eq(schema.posts.id, postId));
  }

  const updatedPost = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });

  return c.json({
    success: true,
    data: {
      isLiked: false,
      likesCount: updatedPost?.likesCount ?? Math.max(0, post.likesCount - (result.length > 0 ? 1 : 0)),
    },
  }, 200);
};

postRouter.delete("/:id/like", handleUnlikePost);
postRouter.post("/:id/unlike", handleUnlikePost);

postRouter.get("/:id/likes", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");
  const { cursor, perPage } = getCursorPagination(c);

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  const likeableType = post ? "POST" : "REEL";
  if (!post) {
    const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });
    if (!reel) throw new HTTPException(404, { message: "Post not found" });
  }

  const whereConditions = [eq(schema.likes.likeableType, likeableType), eq(schema.likes.likeableId, postId)];
  if (cursor) {
    whereConditions.push(lt(schema.likes.createdAt, new Date(cursor)));
  }

  const likers = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      fullName: schema.users.fullName,
      avatarUrl: schema.users.avatarUrl,
      isVerified: schema.users.isVerified,
      createdAt: schema.likes.createdAt,
    })
    .from(schema.likes)
    .innerJoin(schema.users, eq(schema.users.id, schema.likes.userId))
    .where(and(...whereConditions))
    .limit(perPage + 1)
    .orderBy(desc(schema.likes.createdAt));

  const hasMore = likers.length > perPage;
  const items = hasMore ? likers.slice(0, perPage) : likers;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return c.json({
    success: true,
    data: { items, nextCursor, hasMore },
  });
});

postRouter.post("/:id/save", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");
  const collectionId = c.req.query("collectionId");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (post) {
    await db.insert(schema.savedItems)
      .values({ userId: user.id, saveableType: "POST", saveableId: postId, collectionId: collectionId || null })
      .onConflictDoNothing();

    await db.update(schema.posts)
      .set({ savesCount: sql`${schema.posts.savesCount} + 1` })
      .where(eq(schema.posts.id, postId));

    return c.body(null, 204);
  }

  const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });
  if (reel) {
    await db.insert(schema.savedItems)
      .values({ userId: user.id, saveableType: "REEL", saveableId: postId, collectionId: collectionId || null })
      .onConflictDoNothing();

    await db.update(schema.reels)
      .set({ savesCount: sql`${schema.reels.savesCount} + 1` })
      .where(eq(schema.reels.id, postId));

    return c.body(null, 204);
  }

  throw new HTTPException(404, { message: "Post not found" });
});

postRouter.delete("/:id/save", async (c) => {
  const user = getCurrentUser(c);
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (post) {
    await db.delete(schema.savedItems)
      .where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.saveableType, "POST"), eq(schema.savedItems.saveableId, postId)));

    await db.update(schema.posts)
      .set({ savesCount: sql`${schema.posts.savesCount} - 1` })
      .where(eq(schema.posts.id, postId));

    return c.body(null, 204);
  }

  const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, postId) });
  if (reel) {
    await db.delete(schema.savedItems)
      .where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.saveableType, "REEL"), eq(schema.savedItems.saveableId, postId)));

    await db.update(schema.reels)
      .set({ savesCount: sql`${schema.reels.savesCount} - 1` })
      .where(eq(schema.reels.id, postId));

    return c.body(null, 204);
  }

  throw new HTTPException(404, { message: "Post not found" });
});

// ============================================================
// REPORT ENDPOINT
// ============================================================

postRouter.post("/:id/report", zValidator("json", reportSchema), async (c) => {
  const user = getCurrentUser(c);
  const targetId = c.req.param("id");
  const { reason, description } = c.req.valid("json");

  const target = await resolveContentTarget(targetId);
  if (!target) throw new HTTPException(404, { message: "Post not found" });

  await db.insert(schema.reports).values({
    reporterId: user.id,
    reportedType: target.type,
    reportedId: target.id,
    reason,
    description,
  });

  return c.body(null, 204);
});

// ============================================================
// CONTENT RESOLUTION HELPERS (Polymorphic Post / Reel / Story)
// ============================================================

interface ContentTarget {
  type: "POST" | "REEL" | "STORY";
  id: string;
  authorId: string;
}

async function resolveContentTarget(id: string): Promise<ContentTarget | null> {
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, id),
    columns: { id: true, authorId: true },
  });
  if (post) return { type: "POST", id: post.id, authorId: post.authorId };

  const reel = await db.query.reels.findFirst({
    where: eq(schema.reels.id, id),
    columns: { id: true, authorId: true },
  });
  if (reel) return { type: "REEL", id: reel.id, authorId: reel.authorId };

  const story = await db.query.stories.findFirst({
    where: eq(schema.stories.id, id),
    columns: { id: true, authorId: true },
  });
  if (story) return { type: "STORY", id: story.id, authorId: story.authorId };

  return null;
}

async function verifyContentAccess(target: ContentTarget, userId: string): Promise<void> {
  if (target.authorId === userId) return;

  const author = await db.query.users.findFirst({
    where: eq(schema.users.id, target.authorId),
    columns: { isPrivate: true },
  });
  if (author?.isPrivate) {
    const following = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, userId),
        eq(schema.follows.followingId, target.authorId),
        eq(schema.follows.status, "ACCEPTED")
      ),
    });
    if (!following) {
      throw new HTTPException(403, { message: "This account is private" });
    }
  }
}

// ============================================================
// COMMENTS ENDPOINTS
// ============================================================

postRouter.get("/:id/comments", async (c) => {
  const user = getCurrentUser(c);
  const targetId = c.req.param("id");
  const cursor = c.req.query("cursor");
  const page = c.req.query("page") ? parseInt(c.req.query("page")!) : undefined;
  const perPage = Math.min(Number(c.req.query("perPage")) || 20, 50);

  const target = await resolveContentTarget(targetId);
  if (!target) throw new HTTPException(404, { message: "Post not found" });

  await verifyContentAccess(target, user.id);

  const result = await getComments(target.type, target.id, user.id, cursor, perPage, page);

  return c.json({
    success: true,
    data: {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      page: result.page,
      perPage: result.perPage,
      total: result.total,
    },
  });
});

postRouter.post("/:id/comments", zValidator("json", commentSchema), async (c) => {
  const user = getCurrentUser(c);
  const targetId = c.req.param("id");
  const body = c.req.valid("json");
  const commentText = body.text || body.content || "";
  const { parentId } = body;

  const target = await resolveContentTarget(targetId);
  if (!target) throw new HTTPException(404, { message: "Post not found" });

  await verifyContentAccess(target, user.id);

  const comment = await createComment({
    commentableType: target.type,
    commentableId: target.id,
    authorId: user.id,
    text: commentText,
    parentId,
  });

  const refType = target.type === "REEL" ? "reel" : target.type === "STORY" ? "story" : "post";
  const deepLink = target.type === "REEL" ? `/reels/${target.id}` : target.type === "STORY" ? `/stories/${target.id}` : `/posts/${target.id}`;
  const notifType = target.type === "REEL" ? "REEL_COMMENT" : target.type === "STORY" ? "STORY_REPLY" : "COMMENT";

  if (target.authorId !== user.id) {
    await db.insert(schema.notifications).values({
      recipientId: target.authorId,
      actorId: user.id,
      type: notifType,
      referenceType: refType,
      referenceId: target.id,
      previewText: commentText.substring(0, 100),
      deepLink,
      groupKey: `comment:${refType}:${target.id}`,
    });
  }

  if (parentId) {
    const parentComment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, parentId),
    });
    if (parentComment && parentComment.authorId !== user.id && parentComment.authorId !== target.authorId) {
      await db.insert(schema.notifications).values({
        recipientId: parentComment.authorId,
        actorId: user.id,
        type: "COMMENT",
        referenceType: refType,
        referenceId: target.id,
        previewText: commentText.substring(0, 100),
        deepLink,
        groupKey: `comment:${refType}:${target.id}`,
      });
    }
  }

  return c.json({ success: true, data: { comment } }, 201);
});

postRouter.delete("/:id/comments/:commentId", async (c) => {
  const user = getCurrentUser(c);
  const targetId = c.req.param("id");
  const commentId = c.req.param("commentId");

  const target = await resolveContentTarget(targetId);
  if (!target) throw new HTTPException(404, { message: "Post not found" });

  await deleteComment(commentId, user.id, target.authorId);

  return c.body(null, 204);
});

postRouter.patch("/comments/:commentId", zValidator("json", z.object({ text: z.string().min(1).max(2000) })), async (c) => {
  const user = getCurrentUser(c);
  const commentId = c.req.param("commentId");
  const { text } = c.req.valid("json");

  const updatedComment = await updateComment(commentId, user.id, { text });
  return c.json({ success: true, data: { comment: updatedComment } });
});

const handleLikeComment = async (c: any) => {
  const user = getCurrentUser(c);
  const commentId = c.req.param("commentId");

  await likeComment(commentId, user.id);
  return c.body(null, 204);
};

const handleUnlikeComment = async (c: any) => {
  const user = getCurrentUser(c);
  const commentId = c.req.param("commentId");

  await unlikeComment(commentId, user.id);
  return c.body(null, 204);
};

postRouter.post("/comments/:commentId/like", handleLikeComment);
postRouter.post("/:id/comments/:commentId/like", handleLikeComment);
postRouter.delete("/comments/:commentId/like", handleUnlikeComment);
postRouter.delete("/:id/comments/:commentId/like", handleUnlikeComment);
postRouter.post("/comments/:commentId/unlike", handleUnlikeComment);
postRouter.post("/:id/comments/:commentId/unlike", handleUnlikeComment);

postRouter.post("/comments/:commentId/report", zValidator("json", reportSchema), async (c) => {
  const user = getCurrentUser(c);
  const commentId = c.req.param("commentId");
  const { reason, description } = c.req.valid("json");

  await reportComment(commentId, user.id, reason, description);
  return c.json({ success: true, data: { message: "Comment reported successfully" } }, 201);
});

postRouter.get("/comments/:commentId/replies", async (c) => {
  const user = getCurrentUser(c);
  const commentId = c.req.param("commentId");
  const cursor = c.req.query("cursor");
  const perPage = Math.min(Number(c.req.query("perPage")) || 20, 50);

  const result = await getReplies(commentId, user.id, cursor, perPage);
  return c.json({
    success: true,
    data: {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
  });
});

export { postRouter };