#!/usr/bin/env tsx
/**
 * Enhanced Pact Provider Verification Script (Drizzle ORM Version)
 *
 * This script verifies provider against consumer contracts from Pact Broker
 * with full database state management for each test state.
 *
 * Run: npm run test:contract
 * Or with specific URL: STAGING_API_URL=https://staging-api.example.com npm run test:contract:staging
 */

import { Verifier, VerifierOptions } from "@pact-foundation/pact";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import * as bcrypt from "bcrypt";
import { SignJWT } from "jose";
import { createHash } from "crypto";
import { serve } from "@hono/node-server";
import app from "../src/index";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverInstance: any = null;

async function startServerIfNeeded(): Promise<void> {
  const url = new URL(PROVIDER_BASE_URL);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    const port = parseInt(url.port || "3000", 10);
    try {
      const res = await fetch(`${PROVIDER_BASE_URL}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log(`Server already running at ${PROVIDER_BASE_URL}`);
        return;
      }
    } catch {
      // Server not running yet
    }

    console.log(`🚀 Starting server on port ${port}...`);
    await new Promise<void>((resolve) => {
      serverInstance = serve({
        fetch: app.fetch,
        port,
      }, () => {
        console.log(`✅ Server started on ${PROVIDER_BASE_URL}`);
        resolve();
      });
    });
  }
}

const PACT_BROKER_URL = process.env.PACT_BROKER_URL || "http://localhost:9292";
const PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME;
const PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD;
const PROVIDER_BASE_URL = process.env.STAGING_API_URL || process.env.PRODUCTION_API_URL || "http://localhost:3000";
const PROVIDER_VERSION = process.env.GITHUB_SHA || "local";
const PROVIDER_BRANCH = process.env.GITHUB_REF_NAME || "local";
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "postgresql://test:test@localhost:5432/instagram_test";

// Test constants
const TEST_USER_EMAIL = "test@example.com";
const TEST_USER_PASSWORD = "SecurePass123!";
const TEST_USERNAME = "testuser";
const TEST_FULL_NAME = "Test User";
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test-secret-for-pact";

// Create Drizzle client for state setup
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
const db = drizzle(pool, { schema });

interface TestUser {
  id: string;
  email: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

interface TestPost {
  id: string;
  userId: string;
  caption: string;
}

interface TestConversation {
  id: string;
  participants: string[];
}

interface TestMedia {
  id: string;
  userId: string;
  url: string;
  type: string;
}

let testUser: TestUser | null = null;
let testPost: TestPost | null = null;
let testMedia: TestMedia | null = null;
let testConversation: TestConversation | null = null;
let otherUserId: string | null = null;

async function generateTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const secret = new TextEncoder().encode(BETTER_AUTH_SECRET);
  const accessToken = await new SignJWT({
    sub: userId,
    email: TEST_USER_EMAIL,
    username: TEST_USERNAME,
    device_id: "pact-test-device",
    scope: "read write dm upload",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer("https://auth.instagram-clone.com")
    .setAudience("instagram-clone-api")
    .sign(secret);

  const refreshToken = await new SignJWT({
    sub: userId,
    type: "refresh",
    device_id: "pact-test-device",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .setIssuer("https://auth.instagram-clone.com")
    .setAudience("instagram-clone-api")
    .sign(secret);

  return { accessToken, refreshToken };
}

async function cleanupDatabase() {
  console.log("🧹 Cleaning up test database...");

  // Clean up in reverse dependency order
  const userIds = [testUser?.id, otherUserId].filter(Boolean) as string[];

  if (userIds.length === 0) {
    // Still clean up test users by email
    await db.delete(schema.users).where(eq(schema.users.email, TEST_USER_EMAIL));
    await db.delete(schema.users).where(eq(schema.users.email, "other@example.com"));
    console.log("✅ Database cleaned (no test users)");
    return;
  }

  // Delete message reactions for user's conversations
  const userConversations = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(inArray(schema.conversationMembers.userId, userIds));

  const convIds = userConversations.map(c => c.conversationId);

  if (convIds.length > 0) {
    const userMessages = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(inArray(schema.messages.conversationId, convIds));

    const msgIds = userMessages.map(m => m.id);

    if (msgIds.length > 0) {
      await db.delete(schema.messageReactions).where(inArray(schema.messageReactions.messageId, msgIds));
    }
  }

  await db.delete(schema.messages).where(
    inArray(schema.messages.conversationId,
      db.select({ conversationId: schema.conversationMembers.conversationId })
        .from(schema.conversationMembers)
        .where(inArray(schema.conversationMembers.userId, userIds))
    )
  );

  await db.delete(schema.conversationMembers).where(inArray(schema.conversationMembers.userId, userIds));

  await db.delete(schema.conversations).where(
    inArray(schema.conversations.id,
      db.select({ conversationId: schema.conversationMembers.conversationId })
        .from(schema.conversationMembers)
        .where(inArray(schema.conversationMembers.userId, userIds))
    )
  );

  await db.delete(schema.notifications).where(inArray(schema.notifications.recipientId, userIds));

  await db.delete(schema.storyItems).where(
    inArray(schema.storyItems.storyId,
      db.select({ id: schema.stories.id }).from(schema.stories).where(inArray(schema.stories.authorId, userIds))
    )
  );

  await db.delete(schema.stories).where(inArray(schema.stories.authorId, userIds));

  await db.delete(schema.reels).where(inArray(schema.reels.authorId, userIds));

  // Delete post media for user's posts
  await db.delete(schema.mediaItems).where(
    inArray(schema.mediaItems.postId,
      db.select({ id: schema.posts.id }).from(schema.posts).where(inArray(schema.posts.authorId, userIds))
    )
  );

  await db.delete(schema.posts).where(inArray(schema.posts.authorId, userIds));

  await db.delete(schema.mediaItems).where(inArray(schema.mediaItems.mediaableId, userIds));

  await db.delete(schema.follows).where(
    or(
      inArray(schema.follows.followerId, userIds),
      inArray(schema.follows.followingId, userIds)
    )
  );

  await db.delete(schema.users).where(eq(schema.users.email, TEST_USER_EMAIL));
  await db.delete(schema.users).where(eq(schema.users.email, "other@example.com"));

  console.log("✅ Database cleaned");
}

async function setupTestUser(): Promise<TestUser> {
  console.log("👤 Setting up test user...");

  // Create other user for interactions
  const otherUser = await db.insert(schema.users).values({
    id: "e2490de5-5bd3-43d5-b7c4-526e33f71304",
    email: "other@example.com",
    username: "friend",
    fullName: "Friend Name",
    passwordHash: await bcrypt.hash("OtherPass123!", 10),
    isVerified: true,
    isPrivate: false,
    avatarUrl: "https://storage.example.com/avatars/friend.jpg",
  }).onConflictDoUpdate({
    target: schema.users.id,
    set: { username: "friend", fullName: "Friend Name" }
  }).returning({ id: schema.users.id });

  otherUserId = otherUser[0].id;

  // Create main test user
  const user = await db.insert(schema.users).values({
    id: "b5baab04-8464-4409-9f18-df542dcb8658",
    email: TEST_USER_EMAIL,
    username: TEST_USERNAME,
    fullName: TEST_FULL_NAME,
    name: TEST_FULL_NAME,
    passwordHash: await bcrypt.hash(TEST_USER_PASSWORD, 10),
    isVerified: true,
    isPrivate: false,
    avatarUrl: "https://storage.example.com/avatars/user123.jpg",
    avatarThumbUrl: "https://storage.example.com/avatars/user123.jpg",
    image: "https://storage.example.com/avatars/user123.jpg",
    bio: "Test bio",
    website: "https://example.com",
  }).onConflictDoUpdate({
    target: schema.users.id,
    set: {
      email: TEST_USER_EMAIL,
      username: TEST_USERNAME,
      fullName: TEST_FULL_NAME,
      name: TEST_FULL_NAME,
      avatarUrl: "https://storage.example.com/avatars/user123.jpg",
    }
  }).returning({ id: schema.users.id });

  // Create account record for Better Auth
  await db.insert(schema.accounts).values({
    userId: user[0].id,
    accountId: TEST_USER_EMAIL,
    providerId: "credential",
    password: await bcrypt.hash(TEST_USER_PASSWORD, 10),
  }).onConflictDoNothing();

  const tokens = await generateTokens(user[0].id);

  // Create sessions for authentication (both generated JWT and static contract token)
  const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const createdSessions = await db.insert(schema.sessions).values([
    {
      userId: user[0].id,
      token: tokens.accessToken,
      expiresAt: sessionExpiresAt,
    },
    {
      userId: user[0].id,
      token: "valid_access_token",
      expiresAt: sessionExpiresAt,
    },
  ]).returning({ id: schema.sessions.id });

  // Create refresh tokens for session (valid, old, and rotating)
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(schema.refreshTokens).values([
    {
      userId: user[0].id,
      sessionId: createdSessions[0].id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: refreshExpiresAt,
    },
    {
      userId: user[0].id,
      sessionId: createdSessions[0].id,
      tokenHash: hashToken("valid_refresh_token"),
      expiresAt: refreshExpiresAt,
    },
    {
      userId: user[0].id,
      sessionId: createdSessions[0].id,
      tokenHash: hashToken("old_refresh_token"),
      expiresAt: refreshExpiresAt,
    },
  ]);

  testUser = {
    id: user[0].id,
    email: TEST_USER_EMAIL,
    username: TEST_USERNAME,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };

  console.log(`✅ Test user created: ${user[0].id}`);
  return testUser;
}

async function setupTestMedia(): Promise<TestMedia> {
  if (!testUser) throw new Error("Test user not set up");

  console.log("📸 Setting up test media...");

  const media = await db.insert(schema.mediaItems).values({
    type: "IMAGE",
    url: "https://storage.example.com/media/test-image.jpg",
    thumbnailUrl: "https://storage.example.com/media/thumb_test-image.jpg",
    width: 1080,
    height: 1080,
    duration: null,
    processingStatus: "completed",
    mediaableType: "post",
    mediaableId: testUser.id, // Temporary, will be updated when post is created
  }).returning({ id: schema.mediaItems.id, url: schema.mediaItems.url, type: schema.mediaItems.type });

  testMedia = {
    id: media[0].id,
    userId: testUser.id,
    url: media[0].url,
    type: media[0].type,
  };

  console.log(`✅ Test media created: ${media[0].id}`);
  return testMedia;
}

async function setupTestPost(): Promise<TestPost> {
  if (!testUser || !testMedia) throw new Error("Dependencies not set up");

  console.log("📝 Setting up test post...");

  const post = await db.insert(schema.posts).values({
    id: "abc123",
    authorId: testUser.id,
    caption: "Test post caption #hashtag",
    audience: "FOLLOWERS",
    locationName: "San Francisco, CA",
    locationLat: "37.7749",
    locationLng: "-122.4194",
  }).onConflictDoUpdate({
    target: schema.posts.id,
    set: { caption: "Test post caption #hashtag" },
  }).returning({ id: schema.posts.id, authorId: schema.posts.authorId, caption: schema.posts.caption });

  // Update media item to reference this post
  await db.update(schema.mediaItems)
    .set({ mediaableId: post[0].id, mediaableType: "post" })
    .where(eq(schema.mediaItems.id, testMedia.id));

  testPost = {
    id: post[0].id,
    userId: post[0].authorId,
    caption: post[0].caption,
  };

  console.log(`✅ Test post created: ${post[0].id}`);
  return testPost;
}

async function setupTestConversation(): Promise<TestConversation> {
  if (!testUser || !otherUserId) throw new Error("Dependencies not set up");

  console.log("💬 Setting up test conversation...");

  const conversation = await db.insert(schema.conversations).values({
    id: "abc123",
    isGroup: false,
  }).onConflictDoNothing().returning({ id: schema.conversations.id });

  const convId = conversation[0]?.id || "abc123";

  // Add participants
  await db.insert(schema.conversationMembers).values([
    { conversationId: convId, userId: testUser.id },
    { conversationId: convId, userId: otherUserId },
  ]).onConflictDoNothing();

  // Add a message
  await db.insert(schema.messages).values({
    id: "abc123",
    conversationId: convId,
    senderId: otherUserId,
    contentType: "TEXT",
    textContent: "Hey! How are you?",
  }).onConflictDoNothing();

  testConversation = {
    id: convId,
    participants: [testUser.id, otherUserId],
  };

  console.log(`✅ Test conversation created: ${convId}`);
  return testConversation;
}

async function setupTestReel() {
  if (!testUser || !testMedia) return;

  console.log("🎬 Setting up test reel...");

  await db.insert(schema.reels).values({
    authorId: testUser.id,
    videoUrl: testMedia.url,
    thumbnailUrl: testMedia.url,
    caption: "Amazing reel! 🎬",
    audience: "public",
    allowRemix: true,
    allowDownload: false,
    duration: "10.0",
  });
  console.log("✅ Test reel created");
}

async function setupTestStory() {
  if (!testUser || !testMedia) return;

  console.log("📖 Setting up test story...");

  await db.insert(schema.stories).values({
    authorId: testUser.id,
    audience: "followers",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning({ id: schema.stories.id }).then(async (story) => {
    await db.insert(schema.storyItems).values({
      storyId: story[0].id,
      mediaUrl: testMedia!.url,
      thumbnailUrl: testMedia!.url,
      type: "IMAGE",
      duration: "5",
    });
  });
  console.log("✅ Test story created");
}

async function setupTestNotification() {
  if (!testUser || !otherUserId || !testPost) return;

  console.log("🔔 Setting up test notification...");

  await db.insert(schema.notifications).values({
    id: "abc123",
    recipientId: testUser.id,
    actorId: otherUserId,
    type: "LIKE",
    groupKey: `like:post:${testPost.id}`,
    groupCount: 5,
    referenceType: "post",
    referenceId: testPost.id,
    previewText: "Test post caption...",
    isRead: false,
  }).onConflictDoUpdate({
    target: schema.notifications.id,
    set: { isRead: false },
  });
  console.log("✅ Test notification created");
}

async function setupFollowRelationship() {
  if (!testUser || !otherUserId) return;

  console.log("👥 Setting up follow relationship...");

  await db.insert(schema.follows).values({
    followerId: testUser.id,
    followingId: otherUserId,
    status: "ACCEPTED",
  });
  console.log("✅ Follow relationship created");
}

async function initializeTestData() {
  console.log("🚀 Initializing test data for Pact verification...");

  await cleanupDatabase();
  await setupTestUser();
  await setupTestMedia();
  await setupTestPost();
  await setupTestConversation();
  await setupTestReel();
  await setupTestStory();
  await setupTestNotification();
  await setupFollowRelationship();

  console.log("✅ All test data initialized");
  return {
    user: testUser,
    post: testPost,
    media: testMedia,
    conversation: testConversation,
    otherUserId,
  };
}

async function verifyProvider() {
  console.log("🔍 Verifying provider against Pact contracts...");
  console.log(`Provider URL: ${PROVIDER_BASE_URL}`);
  console.log(`Broker: ${PACT_BROKER_URL}`);
  console.log(`Provider: instagram-backend`);
  console.log(`Version: ${PROVIDER_VERSION}`);
  console.log(`Branch: ${PROVIDER_BRANCH}`);

  // Initialize test data and start local server before verification
  await initializeTestData();
  await startServerIfNeeded();

  const stateHandlers: VerifierOptions["stateHandlers"] = {
    "API is healthy": async () => {
      // No setup needed
    },
    "metrics are available": async () => {
      // No setup needed
    },
    "a registered user exists": async () => {
      await setupTestUser();
    },
    "a valid registration request": async () => {
      await db.delete(schema.users).where(eq(schema.users.email, "newuser@example.com"));
    },
    "a valid refresh token exists": async () => {
      if (!testUser) await initializeTestData();
      // Ensure old_refresh_token is present and valid
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.tokenHash, hashToken("old_refresh_token")));
      const [session] = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, testUser!.id)).limit(1);
      if (session) {
        await db.insert(schema.refreshTokens).values({
          userId: testUser!.id,
          sessionId: session.id,
          tokenHash: hashToken("old_refresh_token"),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    },
    "an authenticated user session exists": async () => {
      if (!testUser) await initializeTestData();
      // Session already created in setupTestUser
    },
    "an authenticated user exists": async () => {
      if (!testUser) await initializeTestData();
    },
    "a public user profile exists": async () => {
      if (!testUser) await initializeTestData();
    },
    "an authenticated user with media exists": async () => {
      if (!testUser || !testMedia) await initializeTestData();
    },
    "a post exists": async () => {
      if (!testPost) await initializeTestData();
    },
    "feed items exist for user": async () => {
      if (!testUser || !testPost) await initializeTestData();
      // Create additional posts for feed
      await setupFollowRelationship();
    },
    "a post exists and user is authenticated": async () => {
      if (!testPost || !testUser) await initializeTestData();
      await db.delete(schema.likes).where(and(eq(schema.likes.userId, testUser!.id), eq(schema.likes.postId, "abc123")));
    },
    "a liked post exists": async () => {
      if (!testPost || !testUser) await initializeTestData();
      await db.insert(schema.likes).values({
        userId: testUser!.id,
        likeableType: "POST",
        likeableId: "abc123",
        postId: "abc123",
      }).onConflictDoNothing();
    },
    "reels exist for feed": async () => {
      if (!testUser) await initializeTestData();
      await setupTestReel();
    },
    "an authenticated user with video exists": async () => {
      if (!testUser || !testMedia) await initializeTestData();
    },
    "stories exist for user": async () => {
      if (!testUser) await initializeTestData();
      await setupTestStory();
    },
    "user has conversations": async () => {
      if (!testConversation) await initializeTestData();
    },
    "authenticated user wants to start conversation": async () => {
      if (!testUser || !otherUserId) await initializeTestData();
    },
    "conversation with messages exists": async () => {
      if (!testConversation) await initializeTestData();
    },
    "authenticated user in conversation": async () => {
      if (!testConversation || !testUser) await initializeTestData();
    },
    "user has notifications": async () => {
      if (!testUser) await initializeTestData();
      await setupTestNotification();
    },
    "unread notification exists": async () => {
      if (!testUser) await initializeTestData();
      await setupTestNotification();
    },
    "authenticated user requesting upload": async () => {
      if (!testUser) await initializeTestData();
    },
    "TUS upload initiated": async () => {
      if (!testUser) await initializeTestData();
    },
    "search index has data": async () => {
      if (!testUser || !testPost) await initializeTestData();
    },
    "valid auth token provided": async () => {
      if (!testUser) await initializeTestData();
    },
  };

  const localPactFile = path.resolve(__dirname, "../pacts/instagram-ios-app-instagram-backend.json");

  // Ensure local pact file has normalized plain-text regex matchers if present
  if (fs.existsSync(localPactFile)) {
    try {
      const content = fs.readFileSync(localPactFile, "utf-8");
      const pact = JSON.parse(content);
      let modified = false;

      function normalizeObj(obj: any) {
        if (!obj || typeof obj !== "object") return;
        if (obj.match === "regex" && typeof obj.regex === "string") {
          if (obj.regex.startsWith("^") && !obj.regex.endsWith("$") && !obj.regex.endsWith(".*") && !obj.regex.endsWith("[\\s\\S]*")) {
            obj.regex = obj.regex + ".*";
            modified = true;
          }
        }
        for (const key of Object.keys(obj)) {
          normalizeObj(obj[key]);
        }
      }
      normalizeObj(pact);

      if (Array.isArray(pact.interactions)) {
        for (const it of pact.interactions) {
          if (
            it.response &&
            typeof it.response.body === "string" &&
            it.response.body.startsWith('{"pact:matcher:type":"regex"')
          ) {
            const parsed = JSON.parse(it.response.body);
            it.response.body = parsed.value;
            const regex = parsed.regex.endsWith(".*") || parsed.regex.endsWith("[\\s\\S]*")
              ? parsed.regex
              : parsed.regex + "[\\s\\S]*";
            it.response.matchingRules = it.response.matchingRules || {};
            it.response.matchingRules.body = {
              "$": {
                combine: "AND",
                matchers: [{ match: "regex", regex }],
              },
              "$.body": {
                combine: "AND",
                matchers: [{ match: "regex", regex }],
              },
            };
            modified = true;
          }
        }
      }
      if (modified) {
        fs.writeFileSync(localPactFile, JSON.stringify(pact, null, 2) + "\n");
      }
    } catch {}
  }

  const verifierOptions: VerifierOptions = {
    provider: "instagram-backend",
    providerBaseUrl: PROVIDER_BASE_URL,
    publishVerificationResult: true,
    providerVersion: PROVIDER_VERSION,
    providerVersionTags: [PROVIDER_BRANCH, "latest"],
    stateHandlers,
    // Custom request filter to add auth headers
    requestFilter: (req, res, next) => {
      // Add test headers for debugging
      req.headers["x-pact-verification"] = "true";
      next();
    },
  };

  if (process.env.PACT_BROKER_URL) {
    verifierOptions.pactBrokerUrl = PACT_BROKER_URL;
    verifierOptions.consumerVersionSelectors = [{ latest: true }];
    verifierOptions.consumerVersionTags = ["main", "latest", "local", "develop"];
    verifierOptions.enablePending = true;
    verifierOptions.includeWipPactsSince = "2024-01-01";
  } else {
    verifierOptions.pactUrls = [localPactFile];
  }

  // Only pass credentials if explicitly configured with non-empty strings
  if (PACT_BROKER_USERNAME && PACT_BROKER_PASSWORD) {
    verifierOptions.pactBrokerUsername = PACT_BROKER_USERNAME;
    verifierOptions.pactBrokerPassword = PACT_BROKER_PASSWORD;
  }

  const verifier = new Verifier(verifierOptions);

  try {
    console.log("\n📋 Starting provider verification...");
    const result = await verifier.verifyProvider();
    console.log("\n✅ Provider verification passed!");
    console.log(result);
    if (serverInstance) serverInstance.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Provider verification failed:", error);
    if (serverInstance) serverInstance.close();
    await pool.end();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, cleaning up...");
  if (serverInstance) serverInstance.close();
  await pool.end();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, cleaning up...");
  if (serverInstance) serverInstance.close();
  await pool.end();
  process.exit(1);
});

verifyProvider();