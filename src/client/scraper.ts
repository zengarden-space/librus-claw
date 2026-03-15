/**
 * Custom scrapers for Librus Synergia pages that librus-api doesn't handle.
 * Converts relevant HTML sections to Markdown so the AI can read them clearly.
 */

import { createRequire } from "node:module";
import type { Caller } from "./session.js";

const require = createRequire(import.meta.url);

type Cheerio = {
  load(html: string): CheerioStatic;
};
type CheerioStatic = {
  (selector: string, context?: unknown): CheerioElement;
  html(el?: unknown): string;
};
type CheerioElement = {
  find(sel: string): CheerioElement;
  each(fn: (i: number, el: unknown) => void): void;
  text(): string;
  html(): string;
  attr(name: string): string | undefined;
  removeAttr(name: string): CheerioElement;
  replaceWith(content: string): CheerioElement;
  first(): CheerioElement;
  next(): CheerioElement;
  remove(): CheerioElement;
  length: number;
};

type TurndownService = {
  turndown(html: string): string;
  use(plugin: (service: TurndownService) => void): TurndownService;
};

const BASE = "https://synergia.librus.pl";

function makeConverter(): TurndownService {
  const TDS = require("turndown") as new (opts?: object) => TurndownService;
  const { gfm } = require("turndown-plugin-gfm") as {
    gfm: (service: TurndownService) => void;
  };
  const td = new TDS({ headingStyle: "atx", bulletListMarker: "-" });
  td.use(gfm);
  return td;
}

// Lazy singleton
let _td: TurndownService | null = null;
function td(): TurndownService {
  return (_td ??= makeConverter());
}

function toMarkdown($: CheerioStatic, selector: string): string {
  $("script, style, img, input, button, select, textarea").remove();
  $("a:empty").remove();
  $("a[href^='javascript']").removeAttr("href");
  // Unwrap block elements inside cells so content stays on one line
  $("td div, td p, th div, th p").each((_: number, el: unknown) => {
    const $el = ($ as CheerioStatic)(el as never);
    $el.replaceWith($el.html() || "");
  });
  // Replace <br> inside table cells with a space so cell content stays on one line
  $("td br, th br").replaceWith(" ");
  const html = $.html($(selector));
  return html ? td().turndown(html) : "";
}

export async function scrapeDescriptiveGrades(caller: Caller): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_oceny/uczen`);
  const $ = cheerio.load(resp.data);
  // Remove hidden template table used by the grade-detail JS popup
  $("[style*='display: none'], [style*='display:none']").remove();
  return toMarkdown($, "table.decorated.stretch");
}

export async function scrapeAttendance(caller: Caller): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_nb/uczen`);
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.center.big.decorated");
}

export async function scrapeTimetable(caller: Caller, weekStart?: string): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;

  // Stage 1: GET to read available weeks and requestkey
  const initResp = await caller.get(`${BASE}/przegladaj_plan_lekcji`);
  const $init = cheerio.load(initResp.data);
  const requestkey = $init("input[name=requestkey]").attr("value") ?? "";

  // Determine which week to fetch
  let tydzien = weekStart;
  if (!tydzien) {
    const selected = $init("select[name=tydzien] option[selected]").attr("value");
    tydzien = selected ?? $init("select[name=tydzien] option").first().attr("value") ?? "";
  } else {
    let closest = "";
    $init("select[name=tydzien] option").each((_i: number, opt: unknown) => {
      const val = ($init as CheerioStatic)(opt as never).attr("value") ?? "";
      const [from] = val.split("_");
      if (!closest || from <= tydzien!) closest = val;
    });
    if (closest) tydzien = closest;
  }

  if (!tydzien) return "";

  // Stage 2: POST to get the specific week's timetable
  const resp = await caller.post(
    `${BASE}/przegladaj_plan_lekcji`,
    new URLSearchParams({ tydzien, requestkey }),
  );
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.decorated.plan-lekcji");
}

// ── Homework ─────────────────────────────────────────────────────────────────

export async function scrapeHomework(caller: Caller, from: string, to: string): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.post(
    `${BASE}/moje_zadania`,
    new URLSearchParams({ dataOd: from, dataDo: to, przedmiot: "", submitFiltr: "Filtruj" }),
  );
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.decorated.myHomeworkTable");
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export async function scrapeInbox(caller: Caller, folderId: number): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/wiadomosci/${folderId}`);
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.container-message table.decorated.stretch");
}

export async function scrapeInboxMessageLinks(caller: Caller, folderId: number): Promise<string[]> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/wiadomosci/${folderId}`);
  const $ = cheerio.load(resp.data);
  const links: string[] = [];
  $("table.container-message table.decorated.stretch a[href]").each((_: number, el: unknown) => {
    const href = ($ as CheerioStatic)(el as never).attr("href") ?? "";
    if (href.startsWith("/wiadomosci/") && !links.includes(href)) links.push(href);
  });
  return links;
}

export async function scrapeMessageDetail(caller: Caller, messagePath: string): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}${messagePath}`);
  const $ = cheerio.load(resp.data);
  // Extract metadata fields
  const fields: string[] = [];
  $("table.container-message td.medium").each((_: number, el: unknown) => {
    const label = ($ as CheerioStatic)(el as never).text().trim();
    const value = ($ as CheerioStatic)(el as never).next().text().trim();
    if (label && value) fields.push(`**${label}:** ${value}`);
  });
  // Extract message body
  const bodyHtml = $.html($("div.container-message-content"));
  const body = bodyHtml ? td().turndown(bodyHtml) : "";
  return [...fields, "", body].join("\n");
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function scrapeAnnouncements(caller: Caller): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/ogloszenia`);
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "div#body");
}

// ── Student list ──────────────────────────────────────────────────────────────

/**
 * Scrape the list of students linked to the logged-in parent account.
 * Returns empty array for single-student accounts (no /rodzina page).
 */
export async function scrapeStudentList(caller: Caller): Promise<Array<{ id: string; name: string }>> {
  const cheerio = require("cheerio") as Cheerio;
  try {
    const resp = await caller.get(`${BASE}/rodzina`);
    const $ = cheerio.load(resp.data);
    const students: Array<{ id: string; name: string }> = [];
    $("a[href*='zmien_ucznia']").each((_i: number, el: unknown) => {
      const href = ($ as CheerioStatic)(el as never).attr("href") ?? "";
      const idMatch = href.match(/zmien_ucznia[/=?](\d+)/);
      if (idMatch) {
        const name = ($ as CheerioStatic)(el as never).text().replace(/\s+/g, " ").trim();
        if (name) students.push({ id: idMatch[1], name });
      }
    });
    return students;
  } catch {
    return [];
  }
}
