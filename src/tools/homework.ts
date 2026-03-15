import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeHomework } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function registerHomeworkTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_homework", label: "Librus Homework",
    description:
      "Fetch homework assignments from Librus Synergia. " +
      "Use when the user asks about homework, assignments, tasks, or what to study. " +
      "Returns assignments sorted by due date.",
    parameters: Type.Object({
      days: Type.Optional(
        Type.Number({
          description: "Number of days ahead to look for homework. Default: 7.",
        }),
      ),
      pastDays: Type.Optional(
        Type.Number({
          description: "Number of days in the past to include. Default: 30.",
        }),
      ),
      student: Type.Optional(
        Type.String({
          description: "Student ID (from get_librus_students). Omit to use the default student.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const caller = await getLibrusClient(cfg, params.student);

        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - (params.pastDays ?? 30));
        const until = new Date(today);
        until.setDate(today.getDate() + (params.days ?? 7));

        const text = await scrapeHomework(caller, formatDate(from), formatDate(until));

        return {
          details: null, content: [{ type: "text" as const, text }],
        };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
