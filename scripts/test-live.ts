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
import {
  scrapeDescriptiveGrades,
  scrapeAttendance,
  scrapeTimetable,
  scrapeStudentList,
  scrapeHomework,
  scrapeInbox,
  scrapeInboxMessageLinks,
  scrapeMessageDetail,
  scrapeAnnouncements,
} from "../src/client/scraper.js";

const cfg = { username, password };

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log("✓");
    if (process.env.VERBOSE) {
      console.log(String(typeof result === "string" ? result : JSON.stringify(result, null, 2)).slice(0, 800));
    }
  } catch (err) {
    console.log("✗");
    console.error("   ", err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  console.log("\nLibrus Claw — live integration test");
  console.log(`Account: ${username}\n`);

  const caller = await (async () => {
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

  console.log("\n  --- Scrapers ---");
  await run("Grades", () => scrapeDescriptiveGrades(caller));
  await run("Attendance", () => scrapeAttendance(caller));
  await run("Timetable (this week)", () => scrapeTimetable(caller));

  const past30 = formatDate(new Date(Date.now() - 30 * 86400_000));
  const nextWeek = formatDate(new Date(Date.now() + 7 * 86400_000));
  await run("Homework (last 30 days + next 7)", () => scrapeHomework(caller, past30, nextWeek));
  await run("Inbox", () => scrapeInbox(caller, 5));
  if (process.env.VERBOSE) {
    const links = await scrapeInboxMessageLinks(caller, 5);
    for (const link of links.slice(0, 3)) {
      await run(`Message ${link}`, () => scrapeMessageDetail(caller, link));
    }
  }
  await run("Announcements", () => scrapeAnnouncements(caller));

  console.log("\n  --- Students ---");
  const students = await (async () => {
    process.stdout.write("  Student list... ");
    try {
      const list = await scrapeStudentList(caller);
      const summary = list.length > 0
        ? list.map((s) => `${s.name} (id=${s.id})`).join(", ")
        : "single-student account (no /rodzina page)";
      console.log(`✓  ${summary}`);
      if (process.env.VERBOSE) console.log(JSON.stringify(list, null, 2));
      return list;
    } catch (err) {
      console.log("✗");
      console.error("   ", err instanceof Error ? err.message : String(err));
      return [];
    }
  })();

  // If multiple students found, test switching to each
  if (students.length > 1) {
    console.log("\n  --- Multi-student switching ---");
    for (const student of students) {
      await run(`Switch + grades for ${student.name} (id=${student.id})`, async () => {
        const c = await getLibrusClient(cfg, student.id);
        return scrapeDescriptiveGrades(c);
      });
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
