import { db } from "../db/client";
import * as schema from "../db/schema";
import { eq, and, desc, asc, count, sql, inArray, lt, gt, isNull, not } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

// ============================================================
// TYPES
// ============================================================

export interface CommentWithAuthor {
  id: string;
  commentableType: string;
  commentableId: string;
  postId?: string;
  authorId: string;
  parentId: string | null;
  text: string;
  likesCount: number;
  repliesCount: number;
  isHidden: boolean;
  hiddenReason: string | null;
  hiddenBy: string | null;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  children?: CommentWithAuthor[];
  replies?: CommentWithAuthor[];
  isLiked?: boolean;
}

export interface PaginatedComments {
  items: CommentWithAuthor[];
  nextCursor: string | null;
  hasMore: boolean;
  page?: number;
  perPage?: number;
  total?: number;
}

export interface CreateCommentInput {
  commentableType: "POST" | "REEL" | "STORY";
  commentableId: string;
  authorId: string;
  text: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  text: string;
}

// Type for the base comment query result (without children/isLiked)
interface BaseCommentWithAuthor {
  id: string;
  commentableType: string;
  commentableId: string;
  authorId: string;
  parentId: string | null;
  text: string;
  likesCount: number;
  repliesCount: number;
  isHidden: boolean;
  hiddenReason: string | null;
  hiddenBy: string | null;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build the base query for fetching comments with author
 */
function buildCommentQuery(userId?: string) {
  return db
    .select({
      id: schema.comments.id,
      commentableType: schema.comments.commentableType,
      commentableId: schema.comments.commentableId,
      authorId: schema.comments.authorId,
      parentId: schema.comments.parentId,
      text: schema.comments.text,
      likesCount: schema.comments.likesCount,
      repliesCount: schema.comments.repliesCount,
      isHidden: schema.comments.isHidden,
      hiddenReason: schema.comments.hiddenReason,
      hiddenBy: schema.comments.hiddenBy,
      hiddenAt: schema.comments.hiddenAt,
      createdAt: schema.comments.createdAt,
      updatedAt: schema.comments.updatedAt,
      author: {
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        avatarUrl: schema.users.avatarUrl,
        isVerified: schema.users.isVerified,
      },
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId));
}

/**
 * Check if user has liked a comment
 */
async function checkCommentLiked(commentIds: string[], userId: string): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const likes = await db
    .select({ commentId: schema.likes.likeableId })
    .from(schema.likes)
    .where(
      and(
        eq(schema.likes.userId, userId),
        eq(schema.likes.likeableType, "COMMENT"),
        inArray(schema.likes.likeableId, commentIds)
      )
    );
  return new Set(likes.map((l) => l.commentId));
}

/**
 * Get blocked user IDs for a user
 */
async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blocked = await db
    .select({ blockedId: schema.blocks.blockedId })
    .from(schema.blocks)
    .where(eq(schema.blocks.blockerId, userId));
  return blocked.map((b) => b.blockedId);
}

/**
 * Get restricted user IDs for a user (soft block)
 */
async function getRestrictedUserIds(userId: string): Promise<string[]> {
  const restricted = await db
    .select({ restrictedId: schema.restrictions.restrictedId })
    .from(schema.restrictions)
    .where(eq(schema.restrictions.restrictorId, userId));
  return restricted.map((r) => r.restrictedId);
}

// ============================================================
// COMMENT SERVICE FUNCTIONS
// ============================================================

/**
 * Helper to ensure comment object has compatibility fields (postId, replies)
 */
function attachCompatibilityFields(c: CommentWithAuthor): CommentWithAuthor {
  const children = (c.children || []).map(attachCompatibilityFields);
  return {
    ...c,
    postId: c.commentableId,
    children,
    replies: children,
  };
}

/**
 * Get top-level comments for a post/reel/story with cursor-based pagination
 * Supports threaded replies up to 2 levels (parent + 1 level of children)
 */
export async function getComments(
  commentableType: "POST" | "REEL" | "STORY",
  commentableId: string,
  userId: string,
  cursor?: string,
  perPage: number = 20,
  page?: number
): Promise<PaginatedComments> {
  // Get blocked and restricted users to filter out
  const [blockedIds, restrictedIds] = await Promise.all([
    getBlockedUserIds(userId),
    getRestrictedUserIds(userId),
  ]);
  const excludedUserIds = [...blockedIds, ...restrictedIds];

  // Build where conditions
  const whereConditions = [
    eq(schema.comments.commentableType, commentableType),
    eq(schema.comments.commentableId, commentableId),
    isNull(schema.comments.parentId), // Top-level comments only
    isNull(schema.comments.deletedAt),
    eq(schema.comments.isHidden, false),
  ];

  // Exclude blocked/restricted users' comments
  if (excludedUserIds.length > 0) {
    whereConditions.push(not(inArray(schema.comments.authorId, excludedUserIds)));
  }

  // Count total top-level comments for offset pagination and metadata
  const totalResult = await db
    .select({ count: count() })
    .from(schema.comments)
    .where(and(...whereConditions));
  const total = Number(totalResult[0]?.count || 0);

  // Add cursor condition if provided
  if (cursor) {
    whereConditions.push(lt(schema.comments.createdAt, new Date(cursor)));
  }

  // Fetch top-level comments (+1 to check hasMore)
  let query = buildCommentQuery(userId)
    .where(and(...whereConditions))
    .limit(perPage + 1)
    .orderBy(desc(schema.comments.createdAt));

  if (!cursor && page && page > 1) {
    query = (query as any).offset((page - 1) * perPage);
  }

  const commentsList = await query;

  const hasMore = commentsList.length > perPage || (page ? page * perPage < total : false);
  const items = commentsList.slice(0, perPage);
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

  // Get reply previews for each top-level comment (up to 2 levels deep)
  const commentIds = items.map((c) => c.id);
  if (commentIds.length > 0) {
    const replies = await getReplyPreviews(commentIds, userId, 2);

    // Build nested structure
    const commentMap = new Map<string, CommentWithAuthor>(
      items.map((c) => [c.id, { ...c, children: [], replies: [], isLiked: false } as CommentWithAuthor])
    );

    for (const reply of replies) {
      const parent = commentMap.get(reply.parentId!);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(reply);
      }
    }

    // Check likes for all comments (top-level + replies)
    const allCommentIds = [...commentIds, ...replies.map((r) => r.id)];
    const likedSet = await checkCommentLiked(allCommentIds, userId);

    // Attach isLiked and replies alias
    for (const comment of commentMap.values()) {
      comment.isLiked = likedSet.has(comment.id);
      if (comment.children) {
        for (const child of comment.children) {
          child.isLiked = likedSet.has(child.id);
          child.replies = child.children || [];
        }
      }
      comment.replies = comment.children || [];
    }

    return {
      items: Array.from(commentMap.values()).map(attachCompatibilityFields),
      nextCursor,
      hasMore,
      page: page || 1,
      perPage,
      total,
    };
  }

  // No comments, check likes for empty set
  return {
    items: items.map((c) => attachCompatibilityFields({ ...c, children: [], replies: [], isLiked: false } as CommentWithAuthor)),
    nextCursor,
    hasMore,
    page: page || 1,
    perPage,
    total,
  };
}

/**
 * Get reply previews for a list of parent comment IDs
 * Supports up to 2 levels of nesting (parent + children)
 */
async function getReplyPreviews(
  parentIds: string[],
  userId: string,
  maxDepth: number = 2
): Promise<CommentWithAuthor[]> {
  if (parentIds.length === 0) return [];

  // Get blocked and restricted users to filter out
  const [blockedIds, restrictedIds] = await Promise.all([
    getBlockedUserIds(userId),
    getRestrictedUserIds(userId),
  ]);
  const excludedUserIds = [...blockedIds, ...restrictedIds];

  // Get all replies for these parents (up to maxDepth levels)
  // We'll fetch all replies for the parent IDs first, then filter by depth
  const allReplies = await buildCommentQuery(userId)
    .where(
      and(
        inArray(schema.comments.parentId, parentIds),
        isNull(schema.comments.deletedAt),
        eq(schema.comments.isHidden, false),
        excludedUserIds.length > 0
          ? not(inArray(schema.comments.authorId, excludedUserIds))
          : sql`true`
      )
    )
    .orderBy(asc(schema.comments.createdAt));

  // If maxDepth > 1, also get replies to replies (2nd level)
  if (maxDepth >= 2 && allReplies.length > 0) {
    const replyIds = allReplies.map((r) => r.id);
    const secondLevelReplies = await buildCommentQuery(userId)
      .where(
        and(
          inArray(schema.comments.parentId, replyIds),
          isNull(schema.comments.deletedAt),
          eq(schema.comments.isHidden, false),
          excludedUserIds.length > 0
            ? not(inArray(schema.comments.authorId, excludedUserIds))
            : sql`true`
        )
      )
      .orderBy(asc(schema.comments.createdAt));
    return [...allReplies, ...secondLevelReplies].map((r) => ({ ...r, children: [], isLiked: false } as CommentWithAuthor));
  }

  return allReplies.map((r) => ({ ...r, children: [], isLiked: false } as CommentWithAuthor));
}

/**
 * Get replies for a specific comment (for thread expansion)
 */
export async function getReplies(
  commentId: string,
  userId: string,
  cursor?: string,
  perPage: number = 20
): Promise<PaginatedComments> {
  // Verify parent comment exists
  const parentComment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!parentComment) {
    throw new HTTPException(404, { message: "Parent comment not found" });
  }

  // Get blocked and restricted users to filter out
  const [blockedIds, restrictedIds] = await Promise.all([
    getBlockedUserIds(userId),
    getRestrictedUserIds(userId),
  ]);
  const excludedUserIds = [...blockedIds, ...restrictedIds];

  const whereConditions = [
    eq(schema.comments.parentId, commentId),
    isNull(schema.comments.deletedAt),
    eq(schema.comments.isHidden, false),
  ];

  if (excludedUserIds.length > 0) {
    whereConditions.push(not(inArray(schema.comments.authorId, excludedUserIds)));
  }

  if (cursor) {
    whereConditions.push(lt(schema.comments.createdAt, new Date(cursor)));
  }

  const repliesList = await buildCommentQuery(userId)
    .where(and(...whereConditions))
    .limit(perPage + 1)
    .orderBy(asc(schema.comments.createdAt)); // Replies oldest first

  const hasMore = repliesList.length > perPage;
  const items = hasMore ? repliesList.slice(0, perPage) : repliesList;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  // Check likes for replies
  const replyIds = items.map((r) => r.id);
  const likedSet = await checkCommentLiked(replyIds, userId);

  return {
    items: items.map((r) => attachCompatibilityFields({ ...r, children: [], replies: [], isLiked: likedSet.has(r.id) } as CommentWithAuthor)),
    nextCursor,
    hasMore,
  };
}

/**
 * Create a new comment or reply
 */
export async function createComment(input: CreateCommentInput): Promise<CommentWithAuthor> {
  // Verify parent comment exists if parentId provided
  if (input.parentId) {
    const parentComment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, input.parentId),
    });
    if (!parentComment) {
      throw new HTTPException(400, { message: "Invalid parent comment" });
    }
    if (parentComment.commentableType !== input.commentableType) {
      throw new HTTPException(400, { message: "Parent comment type mismatch" });
    }
    if (parentComment.commentableId !== input.commentableId) {
      throw new HTTPException(400, { message: "Parent comment belongs to different content" });
    }
    // Only allow 2 levels of nesting (parent -> reply, no further nesting)
    if (parentComment.parentId) {
      throw new HTTPException(400, { message: "Cannot reply to a reply (max 2 levels)" });
    }
  }

  // Create the comment
  const [comment] = await db
    .insert(schema.comments)
    .values({
      commentableType: input.commentableType,
      commentableId: input.commentableId,
      authorId: input.authorId,
      text: input.text,
      parentId: input.parentId,
    })
    .returning();

  // Increment comments count on parent content
  await incrementCommentsCount(input.commentableType, input.commentableId);

  // If it's a reply, increment replies count on parent comment
  if (input.parentId) {
    await db
      .update(schema.comments)
      .set({ repliesCount: sql`${schema.comments.repliesCount} + 1` })
      .where(eq(schema.comments.id, input.parentId));
  }

  // Fetch with author
  const createdComment = await buildCommentQuery(input.authorId)
    .where(eq(schema.comments.id, comment.id))
    .limit(1)
    .then((rows) => rows[0]);

  return attachCompatibilityFields({ ...createdComment!, children: [], replies: [], isLiked: false } as CommentWithAuthor);
}

/**
 * Update a comment (author only)
 */
export async function updateComment(
  commentId: string,
  userId: string,
  input: UpdateCommentInput
): Promise<CommentWithAuthor> {
  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }
  if (comment.authorId !== userId) {
    throw new HTTPException(403, { message: "Not authorized to edit this comment" });
  }
  if (comment.deletedAt) {
    throw new HTTPException(400, { message: "Cannot edit deleted comment" });
  }

  const [updated] = await db
    .update(schema.comments)
    .set({
      text: input.text,
      updatedAt: new Date(),
    })
    .where(eq(schema.comments.id, commentId))
    .returning();

  const updatedComment = await buildCommentQuery(userId)
    .where(eq(schema.comments.id, commentId))
    .limit(1)
    .then((rows) => rows[0]);

  return attachCompatibilityFields({ ...updatedComment!, children: [], replies: [], isLiked: false } as CommentWithAuthor);
}

/**
 * Delete a comment (author or content author)
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  contentAuthorId?: string
): Promise<void> {
  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  // Check authorization: comment author OR content author
  const isCommentAuthor = comment.authorId === userId;
  const isContentAuthor = contentAuthorId === userId;
  if (!isCommentAuthor && !isContentAuthor) {
    throw new HTTPException(403, { message: "Not authorized to delete this comment" });
  }

  // Soft delete
  await db
    .update(schema.comments)
    .set({ deletedAt: new Date() })
    .where(eq(schema.comments.id, commentId));

  // Decrement comments count on parent content
  await decrementCommentsCount(comment.commentableType, comment.commentableId);

  // If it's a reply, decrement replies count on parent comment
  if (comment.parentId) {
    await db
      .update(schema.comments)
      .set({ repliesCount: sql`${schema.comments.repliesCount} - 1` })
      .where(eq(schema.comments.id, comment.parentId));
  }
}

/**
 * Like a comment
 */
export async function likeComment(commentId: string, userId: string): Promise<void> {
  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }
  if (comment.deletedAt) {
    throw new HTTPException(400, { message: "Cannot like deleted comment" });
  }
  if (comment.isHidden) {
    throw new HTTPException(400, { message: "Cannot like hidden comment" });
  }

  // Check if already liked
  const existing = await db.query.likes.findFirst({
    where: and(
      eq(schema.likes.userId, userId),
      eq(schema.likes.likeableType, "COMMENT"),
      eq(schema.likes.likeableId, commentId)
    ),
  });
  if (existing) {
    // Already liked -> Toggle to unlike
    await db.delete(schema.likes).where(eq(schema.likes.id, existing.id));
    await db
      .update(schema.comments)
      .set({ likesCount: sql`GREATEST(0, ${schema.comments.likesCount} - 1)` })
      .where(eq(schema.comments.id, commentId));
    return;
  }

  // Insert like
  await db.insert(schema.likes).values({
    userId,
    likeableType: "COMMENT",
    likeableId: commentId,
  });

  // Increment likes count
  await db
    .update(schema.comments)
    .set({ likesCount: sql`${schema.comments.likesCount} + 1` })
    .where(eq(schema.comments.id, commentId));
}

/**
 * Unlike a comment
 */
export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  const result = await db
    .delete(schema.likes)
    .where(
      and(
        eq(schema.likes.userId, userId),
        eq(schema.likes.likeableType, "COMMENT"),
        eq(schema.likes.likeableId, commentId)
      )
    )
    .returning({ id: schema.likes.id });

  if (result.length > 0) {
    // Decrement likes count
    await db
      .update(schema.comments)
      .set({ likesCount: sql`GREATEST(0, ${schema.comments.likesCount} - 1)` })
      .where(eq(schema.comments.id, commentId));
  }
}

/**
 * Report a comment
 */
export async function reportComment(
  commentId: string,
  reporterId: string,
  reason: string,
  description?: string
): Promise<void> {
  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }
  if (comment.deletedAt) {
    throw new HTTPException(400, { message: "Cannot report deleted comment" });
  }

  // Prevent self-reporting
  if (comment.authorId === reporterId) {
    throw new HTTPException(400, { message: "Cannot report your own comment" });
  }

  // Check for existing report
  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(schema.reports.reporterId, reporterId),
      eq(schema.reports.reportedType, "COMMENT"),
      eq(schema.reports.reportedId, commentId)
    ),
  });
  if (existingReport) {
    throw new HTTPException(409, { message: "You have already reported this comment" });
  }

  // Create report
  await db.insert(schema.reports).values({
    reporterId,
    reportedType: "COMMENT",
    reportedId: commentId,
    reason: reason as any, // reportReasonEnum
    description,
  });
}

// ============================================================
// HELPER FUNCTIONS FOR COMMENT COUNTS
// ============================================================

async function incrementCommentsCount(
  commentableType: "POST" | "REEL" | "STORY",
  commentableId: string
): Promise<void> {
  if (commentableType === "STORY") {
    await db
      .update(schema.stories)
      .set({ repliesCount: sql`${schema.stories.repliesCount} + 1` })
      .where(eq(schema.stories.id, commentableId));
  } else if (commentableType === "POST") {
    await db
      .update(schema.posts)
      .set({ commentsCount: sql`${schema.posts.commentsCount} + 1` })
      .where(eq(schema.posts.id, commentableId));
  } else if (commentableType === "REEL") {
    await db
      .update(schema.reels)
      .set({ commentsCount: sql`${schema.reels.commentsCount} + 1` })
      .where(eq(schema.reels.id, commentableId));
  }
}

async function decrementCommentsCount(
  commentableType: "POST" | "REEL" | "STORY",
  commentableId: string
): Promise<void> {
  if (commentableType === "STORY") {
    await db
      .update(schema.stories)
      .set({ repliesCount: sql`${schema.stories.repliesCount} - 1` })
      .where(eq(schema.stories.id, commentableId));
  } else if (commentableType === "POST") {
    await db
      .update(schema.posts)
      .set({ commentsCount: sql`${schema.posts.commentsCount} - 1` })
      .where(eq(schema.posts.id, commentableId));
  } else if (commentableType === "REEL") {
    await db
      .update(schema.reels)
      .set({ commentsCount: sql`${schema.reels.commentsCount} - 1` })
      .where(eq(schema.reels.id, commentableId));
  }
}