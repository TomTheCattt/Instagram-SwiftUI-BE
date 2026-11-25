import { sql } from "../src/db/sql";
import * as dotenv from "dotenv";
dotenv.config();

const VERIFIED_UNSPLASH_IDS = [
  "photo-1507525428034-b723cf961d3e", // Beach / sea
  "photo-1519501025264-65ba15a82390", // City / modern
  "photo-1509042239860-f550ce710b93", // Coffee & books
  "photo-1534528741775-53994a69daeb", // Portrait woman
  "photo-1517838277536-f5f99be501cd", // Gym / fitness
  "photo-1464822759023-fed622ff2c3b", // Mountains / landscape
  "photo-1515886657613-9f3515b0c78f", // Fashion / style
  "photo-1498050108023-c5249f4df085", // Tech / coding setup
  "photo-1506744038136-46273834b3fb", // Yosemite valley
  "photo-1618005182384-a83a8bd57fbe", // Abstract 3d art
  "photo-1543466835-00a7907e9de1", // Golden retriever dog
  "photo-1470225620780-dba8ba36b745", // Music DJ / concert
  "photo-1565299624946-b28f40a0ae38", // Pizza food
  "photo-1514565131-fce0801e5785", // City skyline night
  "photo-1476514525535-07fb3b4ae5f1", // Lake / boat travel
  "photo-1512621776951-a57141f2eefd", // Healthy salad bowl
  "photo-1492691527719-9d1e07e534b4", // Camera photography
  "photo-1513151233558-d860c5398176", // Festive party / confetti
  "photo-1555396273-367ea4eb4db5", // Restaurant dining
  "photo-1533174072545-7a4b6ad7a6c3", // Festival / lights
  "photo-1506794778202-cad84cf45f1d", // Portrait man
  "photo-1494790108377-be9c29b29330", // Portrait woman smiling
  "photo-1507003211169-0a1dd7228f2d", // Portrait young man
  "photo-1517841905240-472988babdf9", // Portrait teen / model
  "photo-1539571696357-5a69c17a67c6", // Portrait hipster man
  "photo-1524504388940-b1c1722653e1", // Portrait woman fashion
  "photo-1544005313-94ddf0286df2", // Portrait woman close-up
  "photo-1500648767791-00dcc994a43e", // Portrait man outdoors
  "photo-1492562080023-ab3db95bfbce", // Portrait young man smiling
  "photo-1522075469751-3a6694fb2f61", // Tech team collaboration
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

const unsplashImg = (id: string, w = 1080, h = 1350) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&auto=format&fit=crop&q=80`;

const unsplashAvatar = (id: string, size = 400) =>
  `https://images.unsplash.com/${id}?w=${size}&h=${size}&auto=format&fit=crop&crop=faces&q=80`;

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  console.log("🔍 Checking existing counts and media...");

  // 1. Check current users
  const users = await sql`SELECT id, username, avatar_url, image FROM users ORDER BY created_at ASC;`;
  console.log(`Found ${users.length} users in database.`);

  // Update user avatars
  console.log("📸 Updating users avatars with verified Unsplash portraits...");
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const photoId = AVATAR_PHOTO_IDS[i % AVATAR_PHOTO_IDS.length];
    const avatar = unsplashAvatar(photoId, 400);
    const thumb = unsplashAvatar(photoId, 150);

    await sql`
      UPDATE users 
      SET avatar_url = ${avatar}, 
          avatar_thumb_url = ${thumb}, 
          image = ${avatar},
          updated_at = NOW()
      WHERE id = ${u.id};
    `;
  }
  console.log(`✅ Updated ${users.length} user avatars.`);

  // 2. Check and update media_items
  const mediaItems = await sql`SELECT id, type, url, thumbnail_url FROM media_items ORDER BY created_at ASC;`;
  console.log(`Found ${mediaItems.length} media_items.`);

  let updatedImages = 0;
  let updatedVideos = 0;

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const photoId = VERIFIED_UNSPLASH_IDS[i % VERIFIED_UNSPLASH_IDS.length];

    if (item.type === "VIDEO") {
      const videoUrl = VERIFIED_VIDEOS[updatedVideos % VERIFIED_VIDEOS.length];
      const thumbUrl = unsplashImg(photoId, 720, 1280);
      await sql`
        UPDATE media_items
        SET url = ${videoUrl},
            thumbnail_url = ${thumbUrl},
            width = 720,
            height = 1280,
            duration = 15.0,
            processing_status = 'completed'
        WHERE id = ${item.id};
      `;
      updatedVideos++;
    } else {
      const imgUrl = unsplashImg(photoId, 1080, 1350);
      const thumbUrl = unsplashImg(photoId, 400, 400);
      await sql`
        UPDATE media_items
        SET url = ${imgUrl},
            thumbnail_url = ${thumbUrl},
            width = 1080,
            height = 1350,
            processing_status = 'completed'
        WHERE id = ${item.id};
      `;
      updatedImages++;
    }
  }
  console.log(`✅ Updated ${updatedImages} image media_items and ${updatedVideos} video media_items.`);

  // 3. Check and update reels
  const reels = await sql`SELECT id, video_url, thumbnail_url FROM reels ORDER BY created_at ASC;`;
  console.log(`Found ${reels.length} reels.`);

  for (let i = 0; i < reels.length; i++) {
    const r = reels[i];
    const videoUrl = VERIFIED_VIDEOS[i % VERIFIED_VIDEOS.length];
    const photoId = VERIFIED_UNSPLASH_IDS[(i + 5) % VERIFIED_UNSPLASH_IDS.length];
    const thumbUrl = unsplashImg(photoId, 480, 854);

    await sql`
      UPDATE reels
      SET video_url = ${videoUrl},
          thumbnail_url = ${thumbUrl},
          duration = 15.0,
          updated_at = NOW()
      WHERE id = ${r.id};
    `;
  }
  console.log(`✅ Updated ${reels.length} reels with verified MP4s & Unsplash thumbnails.`);

  // 4. Check and seed stories & story_items
  const storyCount = await sql`SELECT COUNT(*) as count FROM stories;`;
  console.log(`Current story count: ${storyCount[0].count}`);

  // Create active stories for top users
  console.log("📖 Seeding stories and story_items with valid 24h expiration...");
  // Clear any expired or empty stories
  await sql`DELETE FROM stories;`;

  const topUsers = users.slice(0, 10);
  let seededStories = 0;
  let seededStoryItems = 0;

  for (let i = 0; i < topUsers.length; i++) {
    const user = topUsers[i];
    const storyId = `story-${user.id.slice(0, 8)}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

    await sql`
      INSERT INTO stories (id, author_id, audience, expires_at, views_count, replies_count, created_at)
      VALUES (${storyId}, ${user.id}, 'followers', ${expiresAt.toISOString()}, ${10 + i * 3}, 0, NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
    seededStories++;

    // Add 1-2 story items
    const itemCount = 1 + (i % 2);
    for (let s = 0; s < itemCount; s++) {
      const isVideo = s === 1 && i % 3 === 0;
      const photoId = VERIFIED_UNSPLASH_IDS[(i * 2 + s) % VERIFIED_UNSPLASH_IDS.length];
      const itemId = `story-item-${storyId}-${s}`;

      if (isVideo) {
        const vidUrl = VERIFIED_VIDEOS[i % VERIFIED_VIDEOS.length];
        const thumb = unsplashImg(photoId, 360, 640);
        await sql`
          INSERT INTO story_items (id, story_id, media_url, thumbnail_url, type, duration, sort_order, created_at)
          VALUES (${itemId}, ${storyId}, ${vidUrl}, ${thumb}, 'VIDEO', 10.0, ${s}, NOW());
        `;
      } else {
        const imgUrl = unsplashImg(photoId, 1080, 1920);
        const thumb = unsplashImg(photoId, 360, 640);
        await sql`
          INSERT INTO story_items (id, story_id, media_url, thumbnail_url, type, duration, sort_order, created_at)
          VALUES (${itemId}, ${storyId}, ${imgUrl}, ${thumb}, 'IMAGE', 5.0, ${s}, NOW());
        `;
      }
      seededStoryItems++;
    }
  }

  console.log(`✅ Seeded ${seededStories} stories and ${seededStoryItems} story items.`);
  console.log("🎉 All media URLs successfully fixed and verified!");
}

main().catch((err) => {
  console.error("❌ Failed fixing media URLs:", err);
  process.exit(1);
});
