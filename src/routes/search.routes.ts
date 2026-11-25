import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { getSearchService } from "../services/search-service";
import { getPostService } from "../services/post-service";
import { getReelService } from "../services/reel-service";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

// ============================================================================
// Schemas
// ============================================================================

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  type: z.enum(["all", "users", "posts", "reels", "hashtags", "locations", "audio"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const suggestionsQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  timeWindowHours: z.coerce.number().int().min(1).max(168).default(24), // max 1 week
});

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

// ============================================================================
// Search Routes
// ============================================================================

export const searchRoutes = new Hono()
  // All search routes require authentication
  .use("*", authMiddleware)

  // GET /v1/search - Unified search
  .get(
    "/",
    zValidator("query", searchQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, type, limit, cursor } = c.req.valid("query");

      const searchService = getSearchService();
      const types = type && type !== "all" ? [type] : undefined;

      const results = await searchService.search(q, {
        types,
        limit,
        cursor,
        userId: user?.id,
      });

      // Log the search
      if (user?.id) {
        await searchService.logSearch(user.id, q, type || "all", results.items.length);
      }

      const users = results.items.filter((i: any) => i.type === "user" || i.entityType === "user").map((u: any) => ({
        id: u.id,
        username: u.username || "user",
        displayName: u.displayName || u.fullName || u.username || "User",
        avatarUrl: u.avatarUrl || null,
        isVerified: u.isVerified ?? false,
      }));

      const posts = results.items.filter((i: any) => i.type === "post" || i.entityType === "post").map((p: any) => ({
        id: p.id,
        caption: p.caption || "",
        media: p.thumbnailUrl ? [
          {
            type: "image",
            thumbnailUrl: p.thumbnailUrl,
          }
        ] : [],
      }));

      const reels = results.items.filter((i: any) => i.type === "reel" || i.entityType === "reel").map((r: any) => ({
        id: r.id,
        caption: r.caption || "",
        video: {
          thumbnailUrl: r.thumbnailUrl || null,
        },
      }));

      const searchPayload = {
        query: q,
        type: type || "all",
        results: results.items,
        pagination: {
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        },
        tookMs: results.tookMs,
        users,
        posts,
        reels,
      };

      return c.json({
        success: true,
        data: searchPayload,
        ...searchPayload,
      });
    }
  )

  // GET /v1/search/top - Top search results
  .get(
    "/top",
    zValidator("query", searchQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, limit, cursor } = c.req.valid("query");
      const searchService = getSearchService();
      const results = await searchService.search(q, {
        limit,
        cursor,
        userId: user.id,
      });
      const payload = {
        query: q,
        type: "top",
        results: results.items,
        pagination: {
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        },
        tookMs: results.tookMs,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/users - Search users only
  .get(
    "/users",
    zValidator("query", searchQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, limit, cursor } = c.req.valid("query");
      const searchService = getSearchService();
      const results = await searchService.search(q, {
        types: ["users"],
        limit,
        cursor,
        userId: user.id,
      });
      const payload = {
        query: q,
        type: "users",
        results: results.items,
        pagination: {
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        },
        tookMs: results.tookMs,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/tags - Search hashtags
  .get(
    "/tags",
    zValidator("query", searchQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, limit, cursor } = c.req.valid("query");
      const searchService = getSearchService();
      const results = await searchService.search(q, {
        types: ["hashtags"],
        limit,
        cursor,
        userId: user.id,
      });
      const payload = {
        query: q,
        type: "hashtags",
        results: results.items,
        pagination: {
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        },
        tookMs: results.tookMs,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/posts - Search posts
  .get(
    "/posts",
    zValidator("query", searchQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, limit, cursor } = c.req.valid("query");
      const searchService = getSearchService();
      const results = await searchService.search(q, {
        types: ["posts"],
        limit,
        cursor,
        userId: user.id,
      });
      const payload = {
        query: q,
        type: "posts",
        results: results.items,
        pagination: {
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        },
        tookMs: results.tookMs,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/suggestions - Typeahead suggestions
  .get(
    "/suggestions",
    zValidator("query", suggestionsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { q, limit } = c.req.valid("query");

      const searchService = getSearchService();
      const suggestions = await searchService.getSuggestions(q, user.id, limit);

      const payload = {
        query: q,
        suggestions,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/recent - Recent searches
  .get("/recent", async (c) => {
    const user = c.get("user");
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

    const searchService = getSearchService();
    const recent = await searchService.getRecentSearches(user.id, limit);

    const payload = {
      recent,
    };
    return c.json({
      success: true,
      data: payload,
      ...payload,
    });
  })

  // DELETE /v1/search/recent - Clear search history
  .delete("/recent", async (c) => {
    const user = c.get("user");

    const searchService = getSearchService();
    await searchService.clearSearchHistory(user.id);

    return c.json({ success: true, data: { cleared: true } });
  })

  // GET /v1/search/trending - Trending hashtags
  .get(
    "/trending",
    zValidator("query", trendingQuerySchema),
    async (c) => {
      const { limit, timeWindowHours } = c.req.valid("query");

      const searchService = getSearchService();
      const trending = await searchService.getTrendingHashtags(limit, timeWindowHours);

      const payload = {
        trending,
        timeWindowHours,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/search/analytics - Search analytics (admin/moderator only)
  .get(
    "/analytics",
    zValidator("query", analyticsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { days } = c.req.valid("query");

      const searchService = getSearchService();
      const analytics = await searchService.getSearchAnalytics(days);

      const payload = {
        periodDays: days,
        ...analytics,
      };
      return c.json({
        success: true,
        data: payload,
        ...payload,
      });
    }
  )

  // GET /v1/hashtags/:tag - Hashtag page
  .get("/hashtags/:tag", async (c) => {
    const user = c.get("user");
    const tag = c.req.param("tag").toLowerCase().replace(/^#/, "");

    // Find hashtag
    const hashtag = await db.query.hashtags.findFirst({
      where: and(
        eq(schema.hashtags.tag, tag),
        eq(schema.hashtags.isBlocked, false)
      ),
    });

    if (!hashtag) {
      throw new HTTPException(404, { message: "Hashtag not found" });
    }

    // Get top posts for this hashtag
    const postUsages = await db
      .select({ usageId: schema.hashtagUsages.usageId })
      .from(schema.hashtagUsages)
      .where(and(
        eq(schema.hashtagUsages.hashtagId, hashtag.id),
        eq(schema.hashtagUsages.usageType, "post")
      ))
      .limit(50);

    const postIds = postUsages.map(u => u.usageId);
    let posts: any[] = [];

    if (postIds.length > 0) {
      const postsResult = await db
        .select({
          id: schema.posts.id,
          authorId: schema.posts.authorId,
          caption: schema.posts.caption,
          locationName: schema.posts.locationName,
          likesCount: schema.posts.likesCount,
          commentsCount: schema.posts.commentsCount,
          createdAt: schema.posts.createdAt,
          author: {
            id: schema.users.id,
            username: schema.users.username,
            fullName: schema.users.fullName,
            avatarUrl: schema.users.avatarUrl,
            isVerified: schema.users.isVerified,
          },
        })
        .from(schema.posts)
        .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
        .where(and(
          inArray(schema.posts.id, postIds),
          isNull(schema.posts.deletedAt),
          eq(schema.posts.audience, "PUBLIC"),
          isNull(schema.users.deletedAt)
        ))
        .orderBy(sql`(${schema.posts.likesCount} + ${schema.posts.commentsCount}) DESC`)
        .limit(20);

      posts = postsResult;
    }

    // Get top reels for this hashtag
    const reelUsages = await db
      .select({ usageId: schema.hashtagUsages.usageId })
      .from(schema.hashtagUsages)
      .where(and(
        eq(schema.hashtagUsages.hashtagId, hashtag.id),
        eq(schema.hashtagUsages.usageType, "reel")
      ))
      .limit(50);

    const reelIds = reelUsages.map(u => u.usageId);
    let reels: any[] = [];

    if (reelIds.length > 0) {
      const reelsResult = await db
        .select({
          id: schema.reels.id,
          authorId: schema.reels.authorId,
          caption: schema.reels.caption,
          videoUrl: schema.reels.videoUrl,
          thumbnailUrl: schema.reels.thumbnailUrl,
          likesCount: schema.reels.likesCount,
          commentsCount: schema.reels.commentsCount,
          playsCount: schema.reels.playsCount,
          createdAt: schema.reels.createdAt,
          author: {
            id: schema.users.id,
            username: schema.users.username,
            fullName: schema.users.fullName,
            avatarUrl: schema.users.avatarUrl,
            isVerified: schema.users.isVerified,
          },
        })
        .from(schema.reels)
        .innerJoin(schema.users, eq(schema.users.id, schema.reels.authorId))
        .where(and(
          inArray(schema.reels.id, reelIds),
          isNull(schema.reels.deletedAt),
          eq(schema.reels.audience, "public"),
          isNull(schema.users.deletedAt)
        ))
        .orderBy(sql`(${schema.reels.playsCount} + ${schema.reels.likesCount}) DESC`)
        .limit(20);

      reels = reelsResult;
    }

    // Check if current user follows this hashtag (could be a feature)
    // For now, just return the data

    const hashtagPayload = {
      hashtag: {
        id: hashtag.id,
        tag: hashtag.tag,
        postsCount: hashtag.postsCount,
        reelsCount: hashtag.reelsCount,
      },
      topPosts: posts,
      topReels: reels,
    };

    return c.json({
      success: true,
      data: hashtagPayload,
      ...hashtagPayload,
    });
  })

  // GET /v1/locations/:id - Location page
  .get("/locations/:id", async (c) => {
    const user = c.get("user");
    const locationId = c.req.param("id");

    const location = await db.query.locations.findFirst({
      where: eq(schema.locations.id, locationId),
    });

    if (!location) {
      throw new HTTPException(404, { message: "Location not found" });
    }

    // Get top posts for this location
    const postsResult = await db
      .select({
        id: schema.posts.id,
        authorId: schema.posts.authorId,
        caption: schema.posts.caption,
        likesCount: schema.posts.likesCount,
        commentsCount: schema.posts.commentsCount,
        createdAt: schema.posts.createdAt,
        author: {
          id: schema.users.id,
          username: schema.users.username,
          fullName: schema.users.fullName,
          avatarUrl: schema.users.avatarUrl,
          isVerified: schema.users.isVerified,
        },
      })
      .from(schema.posts)
      .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
      .where(and(
        eq(schema.posts.locationId, locationId),
        isNull(schema.posts.deletedAt),
        eq(schema.posts.audience, "PUBLIC"),
        isNull(schema.users.deletedAt)
      ))
      .orderBy(sql`(${schema.posts.likesCount} + ${schema.posts.commentsCount}) DESC`)
      .limit(20);

    const locationPayload = {
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        category: location.category,
        postsCount: location.postsCount,
      },
      topPosts: postsResult,
    };

    return c.json({
      success: true,
      data: locationPayload,
      ...locationPayload,
    });
  });