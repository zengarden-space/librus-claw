import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeDescriptiveGrades } from "../client/scraper.js";
import type { PluginConfig, SubjectGrades } from "../client/types.js";

export function registerGradesTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_grades", label: "Librus Grades",
    description:
      "Fetch student grades from Librus Synergia. Handles both numeric grades (1-6) and " +
      "descriptive grades (oceny opisowe) used in primary schools. " +
      "Use when the user asks about grades, marks, scores, or academic performance.",
    parameters: Type.Object({
      subject: Type.Optional(
        Type.String({
          description: "Filter by subject/area name (Polish, case-insensitive). Omit to get all.",
        }),
      ),
      semester: Type.Optional(
        Type.Number({
          description: "Semester: 1 or 2. Omit to get both.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);

        // Try numeric grades first
        const numeric = (await client.info.getGrades()) as SubjectGrades[];
        const hasNumeric = numeric.some(Boolean);

        if (hasNumeric) {
          let subjects = numeric.filter(Boolean);
          if (params.subject) {
            const q = params.subject.toLowerCase();
            subjects = subjects.filter((s) => s.name?.toLowerCase().includes(q));
          }
          const result = subjects.map((s) => {
            const semesters =
              params.semester !== undefined ? [s.semester[params.semester - 1]] : s.semester;
            return {
              type: "numeric",
              subject: s.name,
              semesters: semesters.map((sem, i) => ({
                semester: params.semester ?? i + 1,
                grades: (sem?.grades ?? []).map((g) => ({ value: g.value, info: g.info })),
                average: sem?.average ?? null,
              })),
              yearAverage: s.average ?? null,
            };
          });
          return { details: null, content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        }

        // Fall back to descriptive grades (primary school)
        let rows = await scrapeDescriptiveGrades(client.caller);

        if (params.subject) {
          const q = params.subject.toLowerCase();
          rows = rows.filter((r) => r.area.toLowerCase().includes(q));
        }

        const result = rows.map((r) => {
          const s1 = params.semester === 2 ? [] : r.semester1;
          const s2 = params.semester === 1 ? [] : r.semester2;
          return {
            type: "descriptive",
            area: r.area,
            semester1: s1.map((g) => ({ value: g.value, date: g.date, skill: g.skill, teacher: g.teacher, comment: g.comment })),
            semester2: s2.map((g) => ({ value: g.value, date: g.date, skill: g.skill, teacher: g.teacher, comment: g.comment })),
          };
        });

        return { details: null, content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
