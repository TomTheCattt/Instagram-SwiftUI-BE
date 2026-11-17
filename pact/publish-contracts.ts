#!/usr/bin/env tsx
/**
 * Pact Contract Publishing Script
 *
 * This script publishes consumer contracts to the Pact Broker using native HTTP.
 * Run after consumer tests pass: npm run pact:publish
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACT_DIR = path.resolve(__dirname, "../pacts");
const PACT_BROKER_URL = process.env.PACT_BROKER_URL || "http://localhost:9292";
const PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME;
const PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD;
const CONSUMER_VERSION = process.env.GITHUB_SHA || process.env.npm_package_version || "dev";
const CONSUMER_BRANCH = process.env.GITHUB_REF_NAME || "local";

function getAuthHeader(): Record<string, string> {
  if (PACT_BROKER_USERNAME && PACT_BROKER_PASSWORD) {
    const creds = Buffer.from(`${PACT_BROKER_USERNAME}:${PACT_BROKER_PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${creds}` };
  }
  return {};
}

async function publishContracts() {
  console.log("📦 Publishing Pact contracts to Pact Broker...");
  console.log(`Broker: ${PACT_BROKER_URL}`);
  console.log(`Version: ${CONSUMER_VERSION}`);
  console.log(`Branch: ${CONSUMER_BRANCH}`);

  if (!fs.existsSync(PACT_DIR)) {
    console.warn(`⚠️ Pact directory does not exist: ${PACT_DIR}`);
    return;
  }

  const files = fs.readdirSync(PACT_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.warn(`⚠️ No pact JSON files found in ${PACT_DIR}`);
    return;
  }

  const authHeaders = getAuthHeader();

  for (const file of files) {
    const filePath = path.join(PACT_DIR, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const pact = JSON.parse(content);
      const consumer = pact.consumer?.name || "instagram-ios-app";
      const provider = pact.provider?.name || "instagram-backend";

      // Normalize non-JSON plain text regex bodies if serialized as stringified JSON
      let modified = false;
      if (Array.isArray(pact.interactions)) {
        for (const it of pact.interactions) {
          if (
            it.response &&
            typeof it.response.body === "string" &&
            it.response.body.startsWith('{"pact:matcher:type":"regex"')
          ) {
            try {
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
            } catch {}
          }
        }
      }
      if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(pact, null, 2) + "\n");
      }

      console.log(`Publishing ${file} (${consumer} -> ${provider})...`);

      // 1. Publish Pact
      const publishUrl = `${PACT_BROKER_URL}/pacts/provider/${encodeURIComponent(provider)}/consumer/${encodeURIComponent(consumer)}/version/${encodeURIComponent(CONSUMER_VERSION)}`;
      const pubRes = await fetch(publishUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(pact),
      });

      if (!pubRes.ok && pubRes.status !== 200 && pubRes.status !== 201) {
        const errorText = await pubRes.text();
        console.warn(`Failed to publish ${file}: HTTP ${pubRes.status} ${errorText}`);
      } else {
        console.log(`✅ Published ${file} successfully`);
      }

      // 2. Tag Consumer Version
      const tags = [CONSUMER_BRANCH, "latest", "main"];
      for (const tag of tags) {
        const tagUrl = `${PACT_BROKER_URL}/pacticipants/${encodeURIComponent(consumer)}/versions/${encodeURIComponent(CONSUMER_VERSION)}/tags/${encodeURIComponent(tag)}`;
        await fetch(tagUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        }).catch(() => {});
      }

      // 3. Register Branch (Pact Broker v2 branches support)
      const branchUrl = `${PACT_BROKER_URL}/pacticipants/${encodeURIComponent(consumer)}/branches/${encodeURIComponent(CONSUMER_BRANCH)}/versions/${encodeURIComponent(CONSUMER_VERSION)}`;
      await fetch(branchUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      }).catch(() => {});
    } catch (err) {
      console.error(`Error publishing ${file}:`, err);
    }
  }

  console.log("✅ Pact publishing process completed!");
}

publishContracts().catch((err) => {
  console.error("❌ Failed to publish contracts:", err);
  process.exit(1);
});
