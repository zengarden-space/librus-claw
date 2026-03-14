/**
 * Custom scrapers for Librus Synergia pages that librus-api doesn't handle.
 * Returns cleaned-up plain text from the relevant page sections — the AI
 * interprets the content, so no field-by-field parsing is needed.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type Cheerio = {
  load(html: string): CheerioStatic;
};
type CheerioStatic = (selector: string, context?: unknown) => CheerioElement;
type CheerioElement = {
  find(sel: string): CheerioElement;
  each(fn: (i: number, el: unknown) => void): void;
  text(): string;
  attr(name: string): string | undefined;
  first(): CheerioElement;
  length: number;
};

const BASE = "https://synergia.librus.pl";

function tableText($: CheerioStatic, selector: string): string {
  return $(selector).text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function scrapeDescriptiveGrades(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_oceny/uczen`);
  const $ = cheerio.load(resp.data);
  return tableText($, "table.decorated.stretch");
}

export async function scrapeAttendance(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<string> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_nb/uczen`);
  const $ = cheerio.load(resp.data);
  return tableText($, "table.center.big.decorated");
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
      const val = $init(opt as never).attr("value") ?? "";
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
  return tableText($, "table.decorated.plan-lekcji");
}
