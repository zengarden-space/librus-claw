import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeTimetable } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function registerTimetableTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_timetable", label: "Librus Timetable",
    description:
      "Fetch the school timetable from Librus Synergia. " +
      "Use when the user asks about their schedule, lessons, classes, or what they have today/tomorrow/this week. " +
      "Returns lessons with times, subjects, and teachers grouped by day.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({
          description: "Any date within the desired week (YYYY-MM-DD). Defaults to current week.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);
        const weekStart = getMondayOf(params.date ? new Date(params.date) : new Date());
        const lessons = await scrapeTimetable(client.caller, weekStart);
        return { details: null, content: [{ type: "text" as const, text: JSON.stringify(lessons, null, 2) }] };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
