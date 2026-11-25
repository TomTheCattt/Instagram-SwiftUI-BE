import { db } from "./client";
import * as schema from "./schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

const PASSWORD = "password123";

const VERIFIED_UNSPLASH_IDS = [
  "photo-1507525428034-b723cf961d3e",
  "photo-1519501025264-65ba15a82390",
  "photo-1509042239860-f550ce710b93",
  "photo-1534528741775-53994a69daeb",
  "photo-1517838277536-f5f99be501cd",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1515886657613-9f3515b0c78f",
  "photo-1498050108023-c5249f4df085",
  "photo-1506774038136-46273834b3fb",
  "photo-1618005182384-a83a8bd57fbe",
  "photo-1543466835-00a7907e9de1",
  "photo-1470225620780-dba8ba36b745",
  "photo-1565299624946-b28f40a0ae38",
  "photo-1514565131-fce0801e5785",
  "photo-1476514525535-07fb3b4ae5f1",
  "photo-1512621776951-a57141f2eefd",
  "photo-1492691527719-9d1e07e534b4",
  "photo-1513151233558-d860c5398176",
  "photo-1555396273-367ea4eb4db5",
  "photo-1533174072545-7a4b6ad7a6c3",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1494790108377-be9c29b29330",
  "photo-1507003211169-0a1dd7228f2d",
  "photo-1517841905240-472988babdf9",
  "photo-1539571696357-5a69c17a67c6",
  "photo-1524504388940-b1c1722653e1",
  "photo-1544005313-94ddf0286df2",
  "photo-1500648767791-00dcc994a43e",
  "photo-1492562080023-ab3db95bfbce",
  "photo-1522075469751-3a6694fb2f61",
];

const AVATAR_PHOTO_IDS = [
  "photo-1534528741775-53994a69daeb",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1494790108377-be9c29b29330",
  "photo-1507003211169-0a1dd7228f2d",
  "photo-1517841905240-472988babdf9",
  "photo-1539571696357-5a69c17a67c6",
  "photo-1524504388940-b1c1722653e1",
  "photo-1544005313-94ddf0286df2",
  "photo-1500648767791-00dcc994a43e",
  "photo-1492562080023-ab3db95bfbce",
];

const VERIFIED_VIDEOS = [
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://media.w3.org/2010/05/bunny/trailer.mp4",
  "https://media.w3.org/2010/05/bunny/movie.mp4",
  "https://vjs.zencdn.net/v/oceans.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
];

// Helper functions
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = <T,>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];
const imageUrl = (index: number, w = 1080, h = 1350) => {
  const id = VERIFIED_UNSPLASH_IDS[Math.abs(index) % VERIFIED_UNSPLASH_IDS.length];
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&auto=format&fit=crop&q=80`;
};
const avatarUrl = (index: number, size = 400) => {
  const id = AVATAR_PHOTO_IDS[Math.abs(index) % AVATAR_PHOTO_IDS.length];
  return `https://images.unsplash.com/${id}?w=${size}&h=${size}&auto=format&fit=crop&crop=faces&q=80`;
};

const firstNames = [
  "Minh", "Lan", "Huy", "Thao", "Duc", "Mai", "Khoa", "Ngoc", "Phong", "Hien",
  "Nam", "Ha", "Tuan", "Linh", "Vinh", "Trang", "Khanh", "My", "Dat", "Quynh",
];

const lastNames = [
  "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Phan", "Vu", "Dang", "Bui",
];

const bios = [
  "Dreamer | Creator | Coffee addict ☕",
  "Living life one photo at a time 📸",
  "Code by day, content by night 💻✨",
  "Travel enthusiast | Food lover 🌍🍜",
  "Minimalist lifestyle advocate 🌿",
];

const postCaptions = [
  "Morning vibes only ☀️ Starting the day right with coffee!",
  "Weekend adventures 🌲 Nature never disappoints.",
  "New project launched! 🚀 So proud of what we built.",
  "Throwback to the best sunset 🌅 Pause and appreciate.",
  "Street photography session 📷 The city tells stories.",
];

export async function seed() {
  console.log("🌱 Starting Drizzle database seed...");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Create Core Test Users
  const userSeeds = [
    { username: "john_doe", email: "john@example.com", fullName: "John Doe", bio: "Tech enthusiast & photographer" },
    { username: "jane_smith", email: "jane@example.com", fullName: "Jane Smith", bio: "Travel & lifestyle content creator" },
    { username: "alex_traveler", email: "alex@example.com", fullName: "Alex Rivera", bio: "Exploring the world one city at a time" },
    { username: "sarah_foodie", email: "sarah@example.com", fullName: "Sarah Chen", bio: "Food critic | Recipe developer" },
    { username: "mike_fitness", email: "mike@example.com", fullName: "Mike Johnson", bio: "Fitness coach | Daily motivation" },
  ];

  // Add more dynamic users
  for (let i = 0; i < 15; i++) {
    const fn = randomChoice(firstNames);
    const ln = randomChoice(lastNames);
    userSeeds.push({
      username: `${fn.toLowerCase()}_${ln.toLowerCase()}_${randomInt(10, 99)}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      fullName: `${fn} ${ln}`,
      bio: randomChoice(bios),
    });
  }

  console.log(`👤 Inserting ${userSeeds.length} users...`);
  const createdUsers: (typeof schema.users.$inferSelect)[] = [];

  for (let i = 0; i < userSeeds.length; i++) {
    const u = userSeeds[i];
    const existing = await db.query.users.findFirst({
      where: sql`${schema.users.username} = ${u.username}`,
    });

    if (existing) {
      createdUsers.push(existing);
      await db
        .insert(schema.accounts)
        .values({
          userId: existing.id,
          accountId: existing.email,
          providerId: "credential",
          password: existing.passwordHash || passwordHash,
        })
        .onConflictDoNothing();
      continue;
    }

    const [inserted] = await db
      .insert(schema.users)
      .values({
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        name: u.fullName,
        bio: u.bio,
        passwordHash,
        avatarUrl: avatarUrl(i),
        avatarThumbUrl: avatarUrl(i, 150),
        image: avatarUrl(i),
        isVerified: Math.random() < 0.2,
      })
      .returning();

    createdUsers.push(inserted);

    // Create Better Auth account for user
    await db
      .insert(schema.accounts)
      .values({
        userId: inserted.id,
        accountId: inserted.email,
        providerId: "credential",
        password: passwordHash,
      })
      .onConflictDoNothing();
  }

  // Ensure Better Auth credential accounts for all users in database
  await db.execute(sql`
    INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
    SELECT gen_random_uuid(), id, email, 'credential', password_hash, NOW(), NOW()
    FROM users
    WHERE password_hash IS NOT NULL
    ON CONFLICT (provider_id, account_id) DO NOTHING;
  `);

  console.log(`✅ ${createdUsers.length} users ready with Better Auth accounts.`);

  // 2. Create Follows
  console.log("🤝 Creating follows...");
  for (let i = 0; i < createdUsers.length; i++) {
    const follower = createdUsers[i];
    const targets = createdUsers.filter((_, idx) => idx !== i).slice(0, 5);

    for (const target of targets) {
      await db
        .insert(schema.follows)
        .values({
          followerId: follower.id,
          followingId: target.id,
          status: "ACCEPTED",
        })
        .onConflictDoNothing();
    }
  }

  // 3. Create Posts & Media
  console.log("📝 Creating posts and media items...");
  const createdPosts: (typeof schema.posts.$inferSelect)[] = [];
  let mediaIndex = 0;

  for (const user of createdUsers) {
    const postCount = randomInt(1, 3);
    for (let p = 0; p < postCount; p++) {
      const caption = randomChoice(postCaptions);
      const [post] = await db
        .insert(schema.posts)
        .values({
          authorId: user.id,
          caption,
          audience: "PUBLIC",
        })
        .returning();

      createdPosts.push(post);

      // Create 1-2 media items per post
      const mediaCount = randomInt(1, 2);
      for (let m = 0; m < mediaCount; m++) {
        await db.insert(schema.mediaItems).values({
          postId: post.id,
          mediaableType: "post",
          mediaableId: post.id,
          url: imageUrl(mediaIndex, 1080, 1350),
          thumbnailUrl: imageUrl(mediaIndex, 400, 400),
          type: "IMAGE",
          sortOrder: m,
          width: 1080,
          height: 1350,
          processingStatus: "completed",
        });
        mediaIndex++;
      }
    }
  }

  console.log(`✅ Created ${createdPosts.length} posts with media.`);

  // 4. Create Reels
  console.log("🎬 Creating reels...");
  const createdReels: (typeof schema.reels.$inferSelect)[] = [];
  for (let r = 0; r < createdUsers.length; r++) {
    const user = createdUsers[r];
    const videoUrl = VERIFIED_VIDEOS[r % VERIFIED_VIDEOS.length];
    const thumbUrl = imageUrl(r + 10, 480, 854);
    const [reel] = await db
      .insert(schema.reels)
      .values({
        authorId: user.id,
        videoUrl,
        thumbnailUrl: thumbUrl,
        caption: `Reel #${r + 1} - Exploring new perspectives! ✨`,
        duration: "15.0",
        likesCount: randomInt(10, 200),
        commentsCount: randomInt(2, 30),
      })
      .returning();
    createdReels.push(reel);
  }
  console.log(`✅ Created ${createdReels.length} reels.`);

  // 5. Create Stories & Story Items
  console.log("📖 Creating active stories...");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  for (let s = 0; s < Math.min(10, createdUsers.length); s++) {
    const user = createdUsers[s];
    const [story] = await db
      .insert(schema.stories)
      .values({
        authorId: user.id,
        audience: "followers",
        expiresAt,
        viewsCount: randomInt(5, 50),
      })
      .returning();

    await db.insert(schema.storyItems).values({
      storyId: story.id,
      mediaUrl: imageUrl(s + 5, 1080, 1920),
      thumbnailUrl: imageUrl(s + 5, 360, 640),
      type: "IMAGE",
      duration: "5.0",
      sortOrder: 0,
    });
  }
  console.log(`✅ Created active stories for top users.`);

  // 4. Create Likes & Comments
  console.log("💬 Creating comments and likes...");
  for (const post of createdPosts.slice(0, 20)) {
    const likers = createdUsers.slice(0, randomInt(2, 6));
    for (const liker of likers) {
      await db
        .insert(schema.likes)
        .values({
          userId: liker.id,
          likeableType: "POST",
          likeableId: post.id,
        })
        .onConflictDoNothing();
    }

    const commenters = createdUsers.slice(0, randomInt(1, 3));
    for (const commenter of commenters) {
      await db.insert(schema.comments).values({
        authorId: commenter.id,
        commentableType: "POST",
        commentableId: post.id,
        text: "Amazing shot! 🔥",
      });
    }

    // Update post counts
    await db
      .update(schema.posts)
      .set({
        likesCount: likers.length,
        commentsCount: commenters.length,
      })
      .where(sql`${schema.posts.id} = ${post.id}`);
  }

  console.log("🎉 Database seeding completed successfully!");
}

// Execute if run directly
seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
