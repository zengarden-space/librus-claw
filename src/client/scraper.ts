/**
 * Custom scrapers for Librus Synergia pages that librus-api doesn't handle.
 * Converts relevant HTML sections to Markdown so the AI can read them clearly.
 */

import { createRequire } from "node:module";

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
  attr(name: string): string | undefined;
  first(): CheerioElement;
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
  const html = $.html($(selector));
  return html ? td().turndown(html) : "";
}

export async function scrapeDescriptiveGrades(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_oceny/uczen`);
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.decorated.stretch");
}

export async function scrapeAttendance(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_nb/uczen`);
  const $ = cheerio.load(resp.data);
  return toMarkdown($, "table.center.big.decorated");
}

export async function scrapeTimetable(
  caller: {
    get(url: string): Promise<{ data: string }>;
    post(url: string, data: unknown): Promise<{ data: string }>;
  },
  weekStart?: string,
): Promise<string> {
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

/**
 * Scrape the list of students linked to the logged-in parent account.
 * Returns empty array for single-student accounts (no /rodzina page).
 */
export async function scrapeStudentList(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<Array<{ id: string; name: string }>> {
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
