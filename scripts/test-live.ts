#!/usr/bin/env node
/**
 * Live integration test against real Librus credentials.
 *
 * Usage:
 *   cp .env.example .env          # fill in your credentials
 *   npm run test:live
 *
 * The .env file is gitignored — credentials never leave your machine.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
function loadEnv(): void {
  const envPath = resolve(__dirname, "..", ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env not found — rely on actual env vars
  }
}

loadEnv();

const username = process.env.LIBRUS_USERNAME;
const password = process.env.LIBRUS_PASSWORD;

if (!username || !password) {
  console.error("Error: LIBRUS_USERNAME and LIBRUS_PASSWORD must be set.");
  console.error("  Copy .env.example to .env and fill in your credentials.");
  process.exit(1);
}

import { getLibrusClient } from "../src/client/session.js";
import { scrapeDescriptiveGrades, scrapeAttendance, scrapeTimetable } from "../src/client/scraper.js";

const cfg = { username, password };

async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log("✓");
    if (process.env.VERBOSE) {
      console.log(JSON.stringify(result, null, 2).slice(0, 500));
    }
  } catch (err) {
    console.log("✗");
    console.error("   ", err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  console.log("\nLibrus Claw — live integration test");
  console.log(`Account: ${username}\n`);

  const client = await (async () => {
    process.stdout.write("  Authenticating... ");
    try {
      const c = await getLibrusClient(cfg);
      console.log("✓");
      return c;
    } catch (err) {
      console.log("✗");
      console.error("  ", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  })();

  await run("Account info", () => client.info.getAccountInfo());
  await run("Announcements", () => client.inbox.listAnnouncements());
  await run("Inbox", () => client.inbox.listInbox(5));
  await run("Homework subjects", () => client.homework.listSubjects());

  console.log("\n  --- Custom scrapers ---");
  await run("Grades (descriptive/numeric)", () => scrapeDescriptiveGrades(client.caller));
  await run("Attendance summary", () => scrapeAttendance(client.caller));
  await run("Timetable (this week)", () => scrapeTimetable(client.caller));

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
