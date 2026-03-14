import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import type { PluginConfig } from "../client/types.js";

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function registerTimetableTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_timetable", label: "Librus Timetable",
    description:
      "Fetch the school timetable from Librus Synergia for a given week. " +
      "Use when the user asks about their schedule, lessons, classes, or what they have today/tomorrow/this week. " +
      "Returns lessons organized by day with times, teachers, and classrooms.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({
          description:
            "Any date within the desired week (YYYY-MM-DD). Defaults to the current week.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);

        const refDate = params.date ? new Date(params.date) : new Date();
        const monday = getMondayOf(refDate);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const from = formatDate(monday);
        const to = formatDate(sunday);

        const raw = await client.calendar.getTimetable(from, to);

        return {
          details: null, content: [{ type: "text" as const, text: JSON.stringify(raw, null, 2) }],
        };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
