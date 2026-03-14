/**
 * Custom scrapers for Librus Synergia pages that librus-api doesn't handle:
 * - Descriptive grades (oceny opisowe) used in primary school grades 1-3
 * - Attendance table (table.center.big.decorated)
 * - Timetable via POST (table.decorated.plan-lekcji)
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
  children(sel?: string): CheerioElement;
  first(): CheerioElement;
  length: number;
  [Symbol.iterator](): Iterator<unknown>;
};

const BASE = "https://synergia.librus.pl";

export type DescriptiveGrade = {
  area: string;
  value: string;
  skill: string;
  date: string;
  teacher: string;
  comment: string;
  semester: number;
};

export type DescriptiveGradeRow = {
  area: string;
  semester1: DescriptiveGrade[];
  semester2: DescriptiveGrade[];
};

export type AttendanceSummary = {
  period: string;
  excused: number;
  unexcused: number;
  total: number;
  late: number;
  released: number;
};

export type TimetableLesson = {
  lessonNo: number;
  timeFrom: string;
  timeTo: string;
  day: string;
  date: string;
  subject: string;
  teacher: string;
};

function parseGradeTitle(title: string): { skill: string; date: string; teacher: string; comment: string } {
  // Title format: "Obszar oceniania: X<br />Umiejętność: Y<br />Data: Z<br />Nauczyciel: N<br />Dodał: D<br />Komentarz: K"
  const get = (key: string) =>
    title.match(new RegExp(`${key}:\\s*([^<\\n]+)`))?.[1]?.trim() ?? "";
  return {
    skill: get("Umiejętność"),
    date: get("Data"),
    teacher: get("Nauczyciel"),
    comment: get("Komentarz"),
  };
}

export async function scrapeDescriptiveGrades(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<DescriptiveGradeRow[]> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_oceny/uczen`);
  const $ = cheerio.load(resp.data);

  const rows: DescriptiveGradeRow[] = [];

  // Each area row: tr.line0 (not the hidden detail rows)
  $("table.decorated.stretch tbody tr.line0").each((_i: number, el: unknown) => {
    const tds = $(el as never).children("td");
    // Need at least: toggle, area name, s1, s2
    if (tds.length < 4) return;

    // td[0] = toggle icon, td[1] = area name, td[2] = semester 1 grades, td[3] = semester 2 grades
    const areaName = $(tds[1 as never]).text().replace(/\s+/g, " ").trim();
    if (!areaName) return;

    const parseGrades = (tdEl: unknown, sem: number): DescriptiveGrade[] => {
      const grades: DescriptiveGrade[] = [];
      $(tdEl as never).find("span.grade-box a").each((_j: number, a: unknown) => {
        const value = $(a as never).text().trim();
        const title = $(a as never).attr("title") ?? "";
        const parsed = parseGradeTitle(title);
        grades.push({ area: areaName, value, semester: sem, ...parsed });
      });
      return grades;
    };

    rows.push({
      area: areaName,
      semester1: parseGrades(tds[2 as never], 1),
      semester2: parseGrades(tds[3 as never], 2),
    });
  });

  return rows;
}

export async function scrapeAttendance(
  caller: { get(url: string): Promise<{ data: string }> },
): Promise<AttendanceSummary[]> {
  const cheerio = require("cheerio") as Cheerio;
  const resp = await caller.get(`${BASE}/przegladaj_nb/uczen`);
  const $ = cheerio.load(resp.data);

  const summaries: AttendanceSummary[] = [];
  let currentPeriod = "";

  $("table.center.big.decorated tbody tr").each((_i: number, el: unknown) => {
    const row = $(el as never);
    // Period header rows
    const periodCell = row.find("td.center.bolded");
    if (periodCell.length) {
      const text = periodCell.text().trim();
      if (text.startsWith("Okres") || text.startsWith("Semestr")) {
        currentPeriod = text;
        return;
      }
    }
    // Summary rows: "Suma za okres X"
    const strongCell = row.find("strong");
    if (strongCell.length && strongCell.first().text().includes("Suma")) {
      const tds = row.children("td");
      const nums = Array.from({ length: tds.length }, (_, k) =>
        parseInt($(tds[k as never]).text().trim()) || 0,
      );
      // Columns: [empty, "Suma label", U, NU, U+NU, SP, ZW] (indices may vary)
      // Find non-zero numbers
      const vals = nums.filter((n) => !isNaN(n));
      summaries.push({
        period: currentPeriod,
        excused: vals[0] ?? 0,
        unexcused: vals[1] ?? 0,
        total: vals[2] ?? 0,
        late: vals[3] ?? 0,
        released: vals[4] ?? 0,
      });
    }
  });

  return summaries;
}

export async function scrapeTimetable(
  caller: {
    get(url: string): Promise<{ data: string }>;
    post(url: string, data: unknown): Promise<{ data: string }>;
  },
  weekStart?: string,
): Promise<TimetableLesson[]> {
  const cheerio = require("cheerio") as Cheerio;

  // First GET to read available weeks and requestkey
  const initResp = await caller.get(`${BASE}/przegladaj_plan_lekcji`);
  const $init = cheerio.load(initResp.data);
  const requestkey = $init("input[name=requestkey]").attr("value") ?? "";

  // Determine which week to fetch
  let tydzien = weekStart;
  if (!tydzien) {
    // Use the week that contains today (selected option), or fall back to first available
    const selected = $init("select[name=tydzien] option[selected]").attr("value");
    tydzien = selected ?? $init("select[name=tydzien] option").first().attr("value") ?? "";
  } else {
    // Find the closest week option to the requested date
    let closest = "";
    $init("select[name=tydzien] option").each((_i: number, opt: unknown) => {
      const val = $init(opt as never).attr("value") ?? "";
      const [from] = val.split("_");
      if (!closest || from <= tydzien!) closest = val;
    });
    if (closest) tydzien = closest;
  }

  if (!tydzien) return [];

  // POST to get the specific week
  const resp = await caller.post(
    `${BASE}/przegladaj_plan_lekcji`,
    new URLSearchParams({ tydzien, requestkey }),
  );
  const $ = cheerio.load(resp.data);

  const lessons: TimetableLesson[] = [];
  const table = $("table.decorated.plan-lekcji");
  if (!table.length) return [];

  // Parse header row for dates
  const headerCells: string[] = [];
  table.find("thead tr td, thead tr th").each((_i: number, th: unknown) => {
    headerCells.push($(th as never).text().replace(/\s+/g, " ").trim());
  });

  // Day columns: indices 2..N-2 (skip Nr lekcji, Godziny, trailing Nr lekcji)
  const dayHeaders = headerCells.slice(2, headerCells.length - 1);

  let currentLessonNo = 0;
  let currentTimeFrom = "";
  let currentTimeTo = "";

  table.find("tbody tr").each((_i: number, tr: unknown) => {
    const cells: string[] = [];
    $(tr as never).find("td, th").each((_j: number, td: unknown) => {
      cells.push($(td as never).text().replace(/\s+/g, " ").trim());
    });

    if (cells.length < 3) return;

    // Main lesson row: first cell is lesson number
    const firstNum = parseInt(cells[0]);
    if (!isNaN(firstNum) && cells.length > 3) {
      currentLessonNo = firstNum;
      // Time from 2nd cell: "HH:MM - HH:MM"
      const timeMatch = cells[1].match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
      if (timeMatch) {
        currentTimeFrom = timeMatch[1];
        currentTimeTo = timeMatch[2];
      }
      // Lesson data starts at index 2
      const lessonCells = cells.slice(2, 2 + dayHeaders.length);
      lessonCells.forEach((cell, dayIdx) => {
        if (!cell || cell === "\u00a0" || cell === "&nbsp;" || cell.trim() === "") return;
        const dayHeader = dayHeaders[dayIdx] ?? "";
        const dateMatch = dayHeader.match(/(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch?.[1] ?? "";
        // dayHeader may be "Poniedziałek2026-03-09" (BR stripped) — split before the date
        const dayName = dayHeader.replace(/\d{4}-\d{2}-\d{2}.*/, "").trim();

        // Parse "Subject -Teacher" format
        const dashIdx = cell.lastIndexOf("-");
        const subject = dashIdx > 0 ? cell.slice(0, dashIdx).trim() : cell;
        const teacher = dashIdx > 0 ? cell.slice(dashIdx + 1).trim() : "";

        lessons.push({
          lessonNo: currentLessonNo,
          timeFrom: currentTimeFrom,
          timeTo: currentTimeTo,
          day: dayName,
          date,
          subject,
          teacher,
        });
      });
    }
  });

  return lessons;
}
