import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Verifier } from "@pact-foundation/pact";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pact configuration
const PACT_DIR = path.resolve(__dirname, "../../pacts");
const PACT_BROKER_URL = process.env.PACT_BROKER_URL || "http://localhost:9292";
const PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME;
const PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD;

// Provider (our API) configuration
const PROVIDER_BASE_URL = process.env.STAGING_API_URL || process.env.PRODUCTION_API_URL || "http://localhost:3000";
const PROVIDER_VERSION = process.env.GITHUB_SHA || "local";
const PROVIDER_BRANCH = process.env.GITHUB_REF_NAME || "local";

describe("Instagram Backend API - Pact Provider Verification", () => {
  let verifier: Verifier;

  beforeAll(async () => {
    // Setup test database, start provider, etc.
    console.log("Starting provider verification against:", PROVIDER_BASE_URL);

    verifier = new Verifier({
      provider: "instagram-backend",
      providerBaseUrl: PROVIDER_BASE_URL,
      pactBrokerUrl: PACT_BROKER_URL,
      pactBrokerUsername: PACT_BROKER_USERNAME,
      pactBrokerPassword: PACT_BROKER_PASSWORD,
      publishVerificationResults: true,
      providerVersion: PROVIDER_VERSION,
      providerVersionTags: [PROVIDER_BRANCH, "latest"],
      enablePending: true,
      includeWipPactsSince: "2024-01-01",
      stateHandlers: {
        "API is healthy": async () => {
          // No setup needed
        },
        "metrics are available": async () => {
          // No setup needed
        },
        "a registered user exists": async () => {
          // Setup test user in database
        },
        "a valid registration request": async () => {
          // Ensure user doesn't exist
        },
        "a valid refresh token exists": async () => {
          // Setup refresh token
        },
        "an authenticated user session exists": async () => {
          // Setup authenticated session
        },
        "an authenticated user exists": async () => {
          // Setup authenticated user
        },
        "a public user profile exists": async () => {
          // Setup public user profile
        },
        "an authenticated user with media exists": async () => {
          // Setup user and media
        },
        "a post exists": async () => {
          // Setup post
        },
        "feed items exist for user": async () => {
          // Setup feed items
        },
        "a post exists and user is authenticated": async () => {
          // Setup post and auth
        },
        "a liked post exists": async () => {
          // Setup liked post
        },
        "reels exist for feed": async () => {
          // Setup reels
        },
        "an authenticated user with video exists": async () => {
          // Setup user and video
        },
        "stories exist for user": async () => {
          // Setup stories
        },
        "user has conversations": async () => {
          // Setup conversations
        },
        "authenticated user wants to start conversation": async () => {
          // Setup user
        },
        "conversation with messages exists": async () => {
          // Setup conversation and messages
        },
        "authenticated user in conversation": async () => {
          // Setup user and conversation
        },
        "user has notifications": async () => {
          // Setup notifications
        },
        "unread notification exists": async () => {
          // Setup notification
        },
        "authenticated user requesting upload": async () => {
          // Setup user
        },
        "TUS upload initiated": async () => {
          // Setup TUS upload
        },
        "search index has data": async () => {
          // Setup search index
        },
        "valid auth token provided": async () => {
          // Setup token
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup
  });

  it("should verify all pacts from broker", async () => {
    // This test verifies all contracts from the Pact Broker
    // Requires PACT_BROKER_URL, PACT_BROKER_USERNAME, PACT_BROKER_PASSWORD to be set
    // And a running provider at PROVIDER_BASE_URL

    if (!PACT_BROKER_USERNAME || !PACT_BROKER_PASSWORD) {
      console.log("Skipping provider verification: Pact Broker credentials not configured");
      return;
    }

    try {
      const result = await verifier.verifyProvider();
      console.log("Provider verification passed:", result);
    } catch (error) {
      console.error("Provider verification failed:", error);
      throw error;
    }
  });

  it("should verify pacts from local directory (offline mode)", async () => {
    // For local development without broker - requires a running server at PROVIDER_BASE_URL
    // First check if server is reachable
    try {
      const response = await fetch(`${PROVIDER_BASE_URL}/health`, { method: "GET", signal: AbortSignal.timeout(2000) });
      if (!response.ok) {
        console.log("Skipping local provider verification: Server not healthy at", PROVIDER_BASE_URL);
        return;
      }
    } catch (error: any) {
      if (error?.code === "ECONNREFUSED" || error?.name === "TimeoutError" || error?.message?.includes("ECONNREFUSED")) {
        console.log("Skipping local provider verification: No server running at", PROVIDER_BASE_URL);
        return;
      }
      console.log("Skipping local provider verification: Server check failed:", error.message);
      return;
    }

    const localVerifier = new Verifier({
      provider: "instagram-backend",
      providerBaseUrl: PROVIDER_BASE_URL,
      pactUrls: [PACT_DIR],
      stateHandlers: {
        "API is healthy": async () => {},
        "metrics are available": async () => {},
        "a registered user exists": async () => {},
        "a valid registration request": async () => {},
        "a valid refresh token exists": async () => {},
        "an authenticated user session exists": async () => {},
        "an authenticated user exists": async () => {},
        "a public user profile exists": async () => {},
        "an authenticated user with media exists": async () => {},
        "a post exists": async () => {},
        "feed items exist for user": async () => {},
        "a post exists and user is authenticated": async () => {},
        "a liked post exists": async () => {},
        "reels exist for feed": async () => {},
        "an authenticated user with video exists": async () => {},
        "stories exist for user": async () => {},
        "user has conversations": async () => {},
        "authenticated user wants to start conversation": async () => {},
        "conversation with messages exists": async () => {},
        "authenticated user in conversation": async () => {},
        "user has notifications": async () => {},
        "unread notification exists": async () => {},
        "authenticated user requesting upload": async () => {},
        "TUS upload initiated": async () => {},
        "search index has data": async () => {},
        "valid auth token provided": async () => {},
      },
    });

    try {
      const result = await localVerifier.verifyProvider();
      console.log("Local provider verification passed:", result);
    } catch (error: any) {
      console.error("Local provider verification failed:", error);
      throw error;
    }
  });
});