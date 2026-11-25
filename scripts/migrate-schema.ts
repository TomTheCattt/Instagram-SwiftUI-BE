import { pool } from "../src/db/client";
import * as dotenv from "dotenv";
dotenv.config();

async function migrate() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("🚀 Starting database schema sync on PostgreSQL...");

  const queries = [
    // 1. media_items
    `ALTER TABLE media_items ADD COLUMN IF NOT EXISTS post_id text REFERENCES posts(id) ON DELETE CASCADE;`,
    
    // 2. likes
    `ALTER TABLE likes ADD COLUMN IF NOT EXISTS post_id text REFERENCES posts(id) ON DELETE CASCADE;`,
    `ALTER TABLE likes ADD COLUMN IF NOT EXISTS reel_id text REFERENCES reels(id) ON DELETE CASCADE;`,
    `ALTER TABLE likes ADD COLUMN IF NOT EXISTS comment_id text REFERENCES comments(id) ON DELETE CASCADE;`,
    `ALTER TABLE likes ADD COLUMN IF NOT EXISTS story_id text REFERENCES stories(id) ON DELETE CASCADE;`,

    // 3. comments
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS post_id text REFERENCES posts(id) ON DELETE CASCADE;`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS reel_id text REFERENCES reels(id) ON DELETE CASCADE;`,

    // 4. saved_items
    `ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS post_id text REFERENCES posts(id) ON DELETE CASCADE;`,
    `ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS reel_id text REFERENCES reels(id) ON DELETE CASCADE;`,
    `ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS audio_track_id text REFERENCES audio_tracks(id) ON DELETE SET NULL;`,

    // 5. conversations
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS canonical_pair text;`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_id text;`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_text text;`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz;`,

    // 6. users active indexes
    `CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_idx ON users(username) WHERE deleted_at IS NULL;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_idx ON users(email) WHERE deleted_at IS NULL;`,

    // 7. messages missing columns
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT '{}'::jsonb NOT NULL;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_emoji varchar(10);`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ephemeral boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_unsent boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS unsent_at timestamptz;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS unsent_for_everyone boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW() NOT NULL;`,

    // 8. message_reactions table
    `CREATE TABLE IF NOT EXISTS message_reactions (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji varchar(10) NOT NULL,
      created_at timestamptz DEFAULT NOW() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique ON message_reactions (message_id, user_id, emoji);`,

    // 9. story_replies table
    `CREATE TABLE IF NOT EXISTS story_replies (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      story_id text NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS story_replies_story_id_idx ON story_replies (story_id);`,

    // 10. calls & call_participants columns
    `ALTER TABLE calls ADD COLUMN IF NOT EXISTS media_server_id text;`,
    `ALTER TABLE calls ADD COLUMN IF NOT EXISTS room_id varchar(100);`,
    `ALTER TABLE call_participants ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE call_participants ADD COLUMN IF NOT EXISTS is_video_off boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE call_participants ADD COLUMN IF NOT EXISTS is_screen_share boolean DEFAULT false NOT NULL;`,
    `ALTER TABLE call_participants ADD COLUMN IF NOT EXISTS connection_quality text;`,

    // 11. pending_uploads & verifications
    `ALTER TABLE pending_uploads ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW() NOT NULL;`,
    `ALTER TABLE verifications ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE;`,

    // 12. tus_uploads table
    `CREATE TABLE IF NOT EXISTS tus_uploads (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      storage_path varchar(500) NOT NULL,
      file_size bigint NOT NULL,
      uploaded_size bigint DEFAULT 0 NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      status varchar(20) DEFAULT 'created' NOT NULL,
      expires_at timestamptz NOT NULL,
      completed_at timestamptz,
      created_at timestamptz DEFAULT NOW() NOT NULL,
      updated_at timestamptz DEFAULT NOW() NOT NULL
    );`,
  ];

  for (const q of queries) {
    try {
      console.log(`Executing: ${q.slice(0, 60).replace(/\n/g, " ")}...`);
      await pool.query(q);
      console.log("  -> OK");
    } catch (err: any) {
      console.error(`  -> ERROR:`, err.message || err);
    }
  }

  console.log("✅ Schema migration finished successfully!");
}

migrate().catch(console.error);
