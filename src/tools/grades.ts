import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeDescriptiveGrades } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

export function registerGradesTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_grades", label: "Librus Grades",
    description:
      "Fetch student grades from Librus Synergia. Handles both numeric grades (1-6) and " +
      "descriptive grades (oceny opisowe) used in primary schools. " +
      "Use when the user asks about grades, marks, scores, or academic performance.",
    parameters: Type.Object({
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
        const text = await scrapeDescriptiveGrades(caller);
        return { details: null, content: [{ type: "text" as const, text }] };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
