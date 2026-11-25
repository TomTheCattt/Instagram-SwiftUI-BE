/**
 * Application-level cron job for refreshing the feed materialized view.
 * Uses setInterval to refresh the materialized view periodically.
 * Runs every 30 seconds to match the requirement.
 */

import { sql } from '../db/sql';

let refreshInterval: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;

/**
 * Refresh the feed_items materialized view
 */
async function refreshFeedMaterializedView(): Promise<void> {
  if (isRefreshing) {
    console.log('[FeedRefresh] Skipping - previous refresh still running');
    return;
  }

  isRefreshing = true;
  const startTime = Date.now();

  try {
    try {
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY feed_items`;
    } catch (err: any) {
      if (err?.code === '55000' || err?.message?.includes('concurrently')) {
        await sql`REFRESH MATERIALIZED VIEW feed_items`;
      } else if (err?.code === '42P01' || err?.message?.includes('feed_items')) {
        console.log('[FeedRefresh] Materialized view feed_items does not exist, skipping refresh');
      } else {
        throw err;
      }
    }
    const duration = Date.now() - startTime;
    console.log(`[FeedRefresh] Completed in ${duration}ms`);
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
      console.warn('[FeedRefresh] Database connection refused (ECONNREFUSED). Waiting for database...');
    } else {
      console.error('[FeedRefresh] Error:', error);
    }
  } finally {
    isRefreshing = false;
  }
}

/**
 * Start the feed refresh job (every 30 seconds)
 */
export function startFeedRefreshJob(): void {
  if (refreshInterval) {
    console.log('[FeedRefresh] Job already running');
    return;
  }

  console.log('[FeedRefresh] Starting job (every 30 seconds)');

  // Run immediately on start
  refreshFeedMaterializedView();

  // Then every 30 seconds
  refreshInterval = setInterval(() => {
    refreshFeedMaterializedView();
  }, 30000);

  // Handle graceful shutdown
  process.on('SIGTERM', stopFeedRefreshJob);
  process.on('SIGINT', stopFeedRefreshJob);
}

/**
 * Stop the feed refresh job
 */
export function stopFeedRefreshJob(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[FeedRefresh] Job stopped');
  }
}

/**
 * Manual trigger for feed refresh (useful for testing or admin endpoints)
 */
export async function triggerFeedRefresh(): Promise<{ success: boolean; durationMs: number }> {
  const startTime = Date.now();
  try {
    await refreshFeedMaterializedView();
    return { success: true, durationMs: Date.now() - startTime };
  } catch (error) {
    return { success: false, durationMs: Date.now() - startTime };
  }
}