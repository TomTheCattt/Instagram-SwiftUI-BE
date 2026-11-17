CREATE TYPE "public"."call_participant_status" AS ENUM('INVITED', 'RINGING', 'JOINING', 'CONNECTED', 'RECONNECTING', 'LEFT', 'DECLINED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('INITIATED', 'RINGING', 'CONNECTING', 'ACTIVE', 'ENDED', 'MISSED', 'DECLINED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('AUDIO', 'VIDEO', 'GROUP_AUDIO', 'GROUP_VIDEO');--> statement-breakpoint
CREATE TYPE "public"."commentable_type" AS ENUM('POST', 'REEL', 'STORY');--> statement-breakpoint
CREATE TYPE "public"."connection_quality" AS ENUM('EXCELLENT', 'GOOD', 'POOR', 'DISCONNECTED');--> statement-breakpoint
CREATE TYPE "public"."message_content_type" AS ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'POST_SHARE', 'REEL_SHARE', 'STORY_SHARE', 'PROFILE_SHARE', 'LOCATION', 'CONTACT', 'VOICE', 'REPLY', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('IOS', 'ANDROID', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."follow_status" AS ENUM('PENDING', 'ACCEPTED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."likeable_type" AS ENUM('POST', 'REEL', 'COMMENT', 'STORY');--> statement-breakpoint
CREATE TYPE "public"."live_status" AS ENUM('SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO', 'CAROUSEL', 'AUDIO');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('WARN', 'CONTENT_REMOVE', 'CONTENT_HIDE', 'ACCOUNT_SUSPEND', 'ACCOUNT_BAN', 'FEATURE_RESTRICT', 'SHADOWBAN', 'RESTORE');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('LIKE', 'COMMENT', 'FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPT', 'MENTION', 'TAGGED_IN_POST', 'TAGGED_IN_COMMENT', 'TAGGED_IN_STORY', 'STORY_MENTION', 'STORY_REPLY', 'REEL_LIKE', 'REEL_COMMENT', 'LIVE_VIDEO', 'LIVE_JOIN', 'DM_MESSAGE', 'DM_REACTION', 'POST_REMINDER', 'ACHIEVEMENT', 'SECURITY_ALERT', 'FEATURE_ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."post_audience" AS ENUM('PUBLIC', 'FOLLOWERS', 'CLOSE_FRIENDS');--> statement-breakpoint
CREATE TYPE "public"."processing_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."processing_job_type" AS ENUM('media', 'video', 'audio', 'image', 'thumbnail', 'transcode', 'nsfw', 'metadata');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('SPAM', 'HATE_SPEECH', 'HARASSMENT', 'VIOLENCE', 'NUDITY', 'SELF_HARM', 'MISINFORMATION', 'SCAM', 'IMPERSONATION', 'COPYRIGHT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('USER', 'POST', 'REEL', 'STORY', 'COMMENT', 'MESSAGE', 'AUDIO');--> statement-breakpoint
CREATE TYPE "public"."saveable_type" AS ENUM('POST', 'REEL', 'AUDIO');--> statement-breakpoint
CREATE TYPE "public"."signaling_direction" AS ENUM('SENT', 'RECEIVED');--> statement-breakpoint
CREATE TYPE "public"."sponsored_campaign_status" AS ENUM('draft', 'active', 'paused', 'ended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sponsored_post_status" AS ENUM('pending', 'active', 'paused', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tus_upload_status" AS ENUM('created', 'uploading', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar(255),
	"password" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"metric" varchar(100) NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"metric" varchar(100) NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"artist" varchar(200),
	"audio_url" varchar(500) NOT NULL,
	"duration" numeric(8, 3),
	"waveform_data" jsonb,
	"is_licensed" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_ip" "inet",
	"actor_user_agent" text,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"correlation_id" text,
	"session_id" text,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"block_profile" boolean DEFAULT true NOT NULL,
	"block_content" boolean DEFAULT true NOT NULL,
	"block_dm" boolean DEFAULT true NOT NULL,
	"block_comments" boolean DEFAULT true NOT NULL,
	"block_mentions" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "call_participant_status" DEFAULT 'INVITED' NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_video_off" boolean DEFAULT false NOT NULL,
	"is_screen_share" boolean DEFAULT false NOT NULL,
	"connection_quality" "connection_quality",
	"device_type" varchar(20),
	"app_version" varchar(20),
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_signaling_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"participant_id" text,
	"direction" "signaling_direction" NOT NULL,
	"message_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"sequence_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "call_type" NOT NULL,
	"status" "call_status" DEFAULT 'INITIATED' NOT NULL,
	"initiator_id" text NOT NULL,
	"conversation_id" text,
	"max_participants" integer DEFAULT 2 NOT NULL,
	"is_recording" boolean DEFAULT false NOT NULL,
	"recording_url" varchar(500),
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"media_server_id" text,
	"room_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "close_friends" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"cover_media_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"commentable_type" "commentable_type" NOT NULL,
	"commentable_id" text NOT NULL,
	"post_id" text,
	"reel_id" text,
	"author_id" text NOT NULL,
	"parent_id" text,
	"text" text NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" varchar(50),
	"hidden_by" text,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"last_read_at" timestamp with time zone,
	"last_delivered_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"group_name" varchar(100),
	"group_avatar_url" varchar(500),
	"group_owner_id" text,
	"canonical_pair" varchar(150),
	"last_message_id" text,
	"last_message_text" text,
	"last_message_at" timestamp with time zone,
	"encryption_type" varchar(20) DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" varchar(500) NOT NULL,
	"platform" "device_platform" DEFAULT 'IOS' NOT NULL,
	"device_id" varchar(200),
	"app_version" varchar(20),
	"os_version" varchar(20),
	"voip_token" varchar(500),
	"sandbox" boolean DEFAULT false NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"status" "follow_status" DEFAULT 'ACCEPTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hashtag_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"hashtag_id" text NOT NULL,
	"usage_type" varchar(10) NOT NULL,
	"usage_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hashtags" (
	"id" text PRIMARY KEY NOT NULL,
	"tag" varchar(50) NOT NULL,
	"posts_count" integer DEFAULT 0 NOT NULL,
	"reels_count" integer DEFAULT 0 NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hashtags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"likeable_type" "likeable_type" NOT NULL,
	"likeable_id" text NOT NULL,
	"post_id" text,
	"reel_id" text,
	"comment_id" text,
	"story_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"live_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"co_host_id" text,
	"title" varchar(200),
	"status" "live_status" DEFAULT 'SCHEDULED' NOT NULL,
	"stream_key" text NOT NULL,
	"playback_url" varchar(500),
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"peak_viewers" integer DEFAULT 0 NOT NULL,
	"total_views" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" varchar(100),
	"name" varchar(200) NOT NULL,
	"address" text,
	"lat" numeric(10, 8),
	"lng" numeric(11, 8),
	"category" varchar(100),
	"posts_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text,
	"mediaable_type" varchar(20) NOT NULL,
	"mediaable_id" text NOT NULL,
	"url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"type" "media_type" NOT NULL,
	"width" integer,
	"height" integer,
	"duration" numeric(8, 3),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"processing_status" varchar(20) DEFAULT 'completed' NOT NULL,
	"processing_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content_type" "message_content_type" NOT NULL,
	"text_content" text,
	"media_url" varchar(500),
	"media_thumbnail" varchar(500),
	"media_duration" numeric(8, 3),
	"media_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reaction_emoji" varchar(10),
	"reply_to_id" text,
	"status" "message_status" DEFAULT 'SENT' NOT NULL,
	"is_ephemeral" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"is_unsent" boolean DEFAULT false NOT NULL,
	"unsent_at" timestamp with time zone,
	"unsent_for_everyone" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"moderator_id" text NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" text NOT NULL,
	"action" "moderation_action" NOT NULL,
	"reason" text,
	"duration" varchar(50),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"reference_type" varchar(20),
	"reference_id" text,
	"preview_text" text,
	"thumbnail_url" varchar(500),
	"deep_link" varchar(500),
	"group_key" varchar(100),
	"group_count" integer DEFAULT 1 NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"url" varchar(500) NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"caption" text,
	"location_id" text,
	"location_name" varchar(200),
	"location_lat" numeric(10, 8),
	"location_lng" numeric(11, 8),
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"sponsor_user_id" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"audience" "post_audience" DEFAULT 'PUBLIC' NOT NULL,
	"close_friends_only" boolean DEFAULT false NOT NULL,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"upload_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "processing_job_type" NOT NULL,
	"status" "processing_job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"processing_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" varchar(200) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"video_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"caption" text,
	"audio_id" text,
	"audio_name" varchar(200),
	"audio_artist" varchar(200),
	"audio_cover_url" varchar(500),
	"is_original_audio" boolean DEFAULT true NOT NULL,
	"duration" numeric(8, 3) NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"plays_count" integer DEFAULT 0 NOT NULL,
	"audience" varchar(20) DEFAULT 'public' NOT NULL,
	"allow_remix" boolean DEFAULT true NOT NULL,
	"allow_download" boolean DEFAULT false NOT NULL,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_type" "report_type" NOT NULL,
	"reported_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'PENDING' NOT NULL,
	"resolution" varchar(50),
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restrictions" (
	"id" text PRIMARY KEY NOT NULL,
	"restrictor_id" text NOT NULL,
	"restricted_id" text NOT NULL,
	"hide_comments" boolean DEFAULT true NOT NULL,
	"dm_to_requests" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text,
	"saveable_type" "saveable_type" NOT NULL,
	"saveable_id" text NOT NULL,
	"post_id" text,
	"reel_id" text,
	"audio_track_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"result_type" varchar(20),
	"result_count" integer,
	"clicked_result_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" text NOT NULL,
	"title" text,
	"description" text,
	"search_vector" text,
	"embedding" vector(1536),
	"author_id" text,
	"created_at" timestamp with time zone,
	"popularity_score" numeric(10, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sponsored_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"sponsor_user_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"target_audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_cents" bigint DEFAULT 0 NOT NULL,
	"spent_cents" bigint DEFAULT 0 NOT NULL,
	"bid_cents" bigint DEFAULT 100 NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"status" "sponsored_campaign_status" DEFAULT 'draft' NOT NULL,
	"max_impressions_per_user_per_day" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"sponsored_post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_impressions" (
	"id" text PRIMARY KEY NOT NULL,
	"sponsored_post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"impression_at" timestamp with time zone DEFAULT now() NOT NULL,
	"impression_date" timestamp with time zone DEFAULT CURRENT_DATE NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"post_id" text NOT NULL,
	"target_audience" jsonb,
	"bid_cents" bigint,
	"status" "sponsored_post_status" DEFAULT 'pending' NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"spent_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"audience" varchar(20) DEFAULT 'followers' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"reel_id" text,
	"shared_from_post_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "story_items" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"media_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"type" "media_type" NOT NULL,
	"duration" numeric(6, 3) DEFAULT '5' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sticker_type" varchar(30),
	"sticker_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_views" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tus_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"file_size" bigint NOT NULL,
	"uploaded_size" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "tus_upload_status" DEFAULT 'created' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" varchar(30) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password_hash" varchar(255),
	"full_name" varchar(100),
	"bio" text DEFAULT '',
	"website" varchar(200),
	"avatar_url" varchar(500),
	"avatar_thumb_url" varchar(500),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_business" boolean DEFAULT false NOT NULL,
	"business_category" varchar(50),
	"posts_count" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"reels_count" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{"language":"en","dark_mode":false,"push_enabled":true,"biometric_enabled":true,"story_controls":{"allow_replies":"followers","allow_sharing":true},"comment_controls":{"allow_comments_from":"everyone","block_keywords":[]},"privacy":{"activity_status":true,"read_receipts":true}}'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" varchar(100),
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_signaling_logs" ADD CONSTRAINT "call_signaling_logs_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_signaling_logs" ADD CONSTRAINT "call_signaling_logs_participant_id_call_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."call_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_friends" ADD CONSTRAINT "close_friends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_friends" ADD CONSTRAINT "close_friends_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_owner_id_users_id_fk" FOREIGN KEY ("group_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hashtag_usages" ADD CONSTRAINT "hashtag_usages_hashtag_id_hashtags_id_fk" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_comments" ADD CONSTRAINT "live_comments_live_id_live_videos_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."live_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_comments" ADD CONSTRAINT "live_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_videos" ADD CONSTRAINT "live_videos_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_videos" ADD CONSTRAINT "live_videos_co_host_id_users_id_fk" FOREIGN KEY ("co_host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_uploads" ADD CONSTRAINT "pending_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_sponsor_user_id_users_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_upload_id_tus_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."tus_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_audio_id_audio_tracks_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."audio_tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_restrictor_id_users_id_fk" FOREIGN KEY ("restrictor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_restricted_id_users_id_fk" FOREIGN KEY ("restricted_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_audio_track_id_audio_tracks_id_fk" FOREIGN KEY ("audio_track_id") REFERENCES "public"."audio_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_campaigns" ADD CONSTRAINT "sponsored_campaigns_sponsor_user_id_users_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_clicks" ADD CONSTRAINT "sponsored_clicks_sponsored_post_id_sponsored_posts_id_fk" FOREIGN KEY ("sponsored_post_id") REFERENCES "public"."sponsored_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_clicks" ADD CONSTRAINT "sponsored_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_impressions" ADD CONSTRAINT "sponsored_impressions_sponsored_post_id_sponsored_posts_id_fk" FOREIGN KEY ("sponsored_post_id") REFERENCES "public"."sponsored_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_impressions" ADD CONSTRAINT "sponsored_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_posts" ADD CONSTRAINT "sponsored_posts_campaign_id_sponsored_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sponsored_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_posts" ADD CONSTRAINT "sponsored_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_shared_from_post_id_posts_id_fk" FOREIGN KEY ("shared_from_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_replies" ADD CONSTRAINT "story_replies_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_replies" ADD CONSTRAINT "story_replies_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_replies" ADD CONSTRAINT "story_replies_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tus_uploads" ADD CONSTRAINT "tus_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_unique" ON "analytics_daily" USING btree ("date","metric");--> statement-breakpoint
CREATE INDEX "analytics_daily_date_idx" ON "analytics_daily" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analytics_daily_metric_idx" ON "analytics_daily" USING btree ("metric");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_hourly_unique" ON "analytics_hourly" USING btree ("hour","metric");--> statement-breakpoint
CREATE INDEX "analytics_hourly_hour_idx" ON "analytics_hourly" USING btree ("hour" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analytics_hourly_metric_idx" ON "analytics_hourly" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "audio_tracks_name_idx" ON "audio_tracks" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_correlation_idx" ON "audit_logs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_unique" ON "blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "blocks_blocker_id_idx" ON "blocks" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_id_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "call_participants_unique" ON "call_participants" USING btree ("call_id","user_id");--> statement-breakpoint
CREATE INDEX "call_participants_call_idx" ON "call_participants" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_participants_user_idx" ON "call_participants" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "call_participants_status_idx" ON "call_participants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "call_signaling_logs_call_idx" ON "call_signaling_logs" USING btree ("call_id","created_at");--> statement-breakpoint
CREATE INDEX "call_signaling_logs_sequence_idx" ON "call_signaling_logs" USING btree ("call_id","sequence_id");--> statement-breakpoint
CREATE INDEX "call_signaling_logs_participant_idx" ON "call_signaling_logs" USING btree ("participant_id","created_at");--> statement-breakpoint
CREATE INDEX "calls_initiator_idx" ON "calls" USING btree ("initiator_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "calls_conversation_idx" ON "calls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calls_room_idx" ON "calls" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "close_friends_unique" ON "close_friends" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX "close_friends_user_id_idx" ON "close_friends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "close_friends_friend_id_idx" ON "close_friends" USING btree ("friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_unique" ON "collections" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "comments_thread_idx" ON "comments" USING btree ("commentable_type","commentable_id","parent_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comments_post_id_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "comments_reel_id_idx" ON "comments" USING btree ("reel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_members_unique" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_last_msg_idx" ON "conversations" USING btree ("last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_canonical_pair_idx" ON "conversations" USING btree ("canonical_pair");--> statement-breakpoint
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_tokens_user_id_active_idx" ON "device_tokens" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "device_tokens_expires_at_idx" ON "device_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_unique" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "follows_pending_idx" ON "follows" USING btree ("following_id") WHERE "follows"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "hashtag_usages_unique" ON "hashtag_usages" USING btree ("hashtag_id","usage_type","usage_id");--> statement-breakpoint
CREATE INDEX "hashtag_usages_usage_idx" ON "hashtag_usages" USING btree ("usage_type","usage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hashtags_tag_idx" ON "hashtags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_unique" ON "likes" USING btree ("user_id","likeable_type","likeable_id");--> statement-breakpoint
CREATE INDEX "likes_likeable_idx" ON "likes" USING btree ("likeable_type","likeable_id");--> statement-breakpoint
CREATE INDEX "likes_user_idx" ON "likes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "likes_post_id_idx" ON "likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "likes_reel_id_idx" ON "likes" USING btree ("reel_id");--> statement-breakpoint
CREATE INDEX "live_comments_live_idx" ON "live_comments" USING btree ("live_id","created_at");--> statement-breakpoint
CREATE INDEX "live_videos_host_idx" ON "live_videos" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "live_videos_status_idx" ON "live_videos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "locations_geo_idx" ON "locations" USING gist ("lat","lng");--> statement-breakpoint
CREATE INDEX "media_items_polymorphic_idx" ON "media_items" USING btree ("mediaable_type","mediaable_id","sort_order");--> statement-breakpoint
CREATE INDEX "media_items_post_id_idx" ON "media_items" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "media_items_processing_idx" ON "media_items" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_unique" ON "message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "messages_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_reply_idx" ON "messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_moderator_idx" ON "moderation_actions" USING btree ("moderator_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_group_idx" ON "notifications" USING btree ("recipient_id","group_key","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pending_uploads_confirmed_idx" ON "pending_uploads" USING btree ("confirmed","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_created_idx" ON "posts" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_search_vector_idx" ON "posts" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "posts_location_geo_idx" ON "posts" USING gist ("location_lat","location_lng");--> statement-breakpoint
CREATE INDEX "processing_jobs_upload_id_idx" ON "processing_jobs" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_user_id_idx" ON "processing_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processing_jobs_type_status_idx" ON "processing_jobs" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_buckets_unique" ON "rate_limit_buckets" USING btree ("identifier","endpoint","window_start");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_lookup_idx" ON "rate_limit_buckets" USING btree ("identifier","endpoint","window_end");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_cleanup_idx" ON "rate_limit_buckets" USING btree ("window_end");--> statement-breakpoint
CREATE INDEX "reels_author_created_idx" ON "reels" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reels_explore_idx" ON "reels" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reels_search_vector_idx" ON "reels" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_reported_idx" ON "reports" USING btree ("reported_type","reported_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "restrictions_unique" ON "restrictions" USING btree ("restrictor_id","restricted_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_unique" ON "saved_items" USING btree ("user_id","saveable_type","saveable_id");--> statement-breakpoint
CREATE INDEX "saved_items_user_idx" ON "saved_items" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "saved_items_collection_id_idx" ON "saved_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "search_history_user_idx" ON "search_history" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "search_index_unique" ON "search_index" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "search_index_embedding_idx" ON "search_index" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "search_index_type_popularity_idx" ON "search_index" USING btree ("content_type","popularity_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sponsored_campaigns_active" ON "sponsored_campaigns" USING btree ("status","start_at","end_at") WHERE "sponsored_campaigns"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_sponsored_campaigns_sponsor" ON "sponsored_campaigns" USING btree ("sponsor_user_id");--> statement-breakpoint
CREATE INDEX "idx_sponsored_clicks_post_user" ON "sponsored_clicks" USING btree ("sponsored_post_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_sponsored_clicks_user" ON "sponsored_clicks" USING btree ("user_id","clicked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_sponsored_impressions_post_user_date" ON "sponsored_impressions" USING btree ("sponsored_post_id","user_id","impression_date");--> statement-breakpoint
CREATE INDEX "idx_sponsored_impressions_user_date" ON "sponsored_impressions" USING btree ("user_id","impression_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsored_posts_unique" ON "sponsored_posts" USING btree ("campaign_id","post_id");--> statement-breakpoint
CREATE INDEX "idx_sponsored_posts_campaign" ON "sponsored_posts" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "idx_sponsored_posts_post" ON "sponsored_posts" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "stories_author_expires_idx" ON "stories" USING btree ("author_id","expires_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stories_expires_idx" ON "stories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "story_items_story_id_idx" ON "story_items" USING btree ("story_id","sort_order");--> statement-breakpoint
CREATE INDEX "story_replies_story_id_idx" ON "story_replies" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_views_unique" ON "story_views" USING btree ("story_id","viewer_id");--> statement-breakpoint
CREATE INDEX "tus_uploads_user_id_idx" ON "tus_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tus_uploads_status_idx" ON "tus_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tus_uploads_expires_at_idx" ON "tus_uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tus_uploads_user_status_idx" ON "tus_uploads" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_active_idx" ON "users" USING btree ("username") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_identifier_value_idx" ON "verifications" USING btree ("identifier","value");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_user_id_idx" ON "verifications" USING btree ("user_id");