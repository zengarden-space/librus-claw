import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import type { PluginConfig, SubjectGrades } from "../client/types.js";

export function registerGradesTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_grades", label: "Librus Grades",
    description:
      "Fetch student grades from Librus Synergia, organized by subject with averages. " +
      "Use when the user asks about grades, marks, scores, or academic performance. " +
      "Returns all subjects with individual grades and weighted averages per semester.",
    parameters: Type.Object({
      subject: Type.Optional(
        Type.String({
          description: "Filter by subject name (Polish, case-insensitive substring match). Omit to get all subjects.",
        }),
      ),
      semester: Type.Optional(
        Type.Number({
          description: "Semester index: 0 for first, 1 for second. Omit to get both semesters.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);
        const raw = (await client.info.getGrades()) as SubjectGrades[];

        let subjects = raw.filter(Boolean);

        if (params.subject) {
          const q = params.subject.toLowerCase();
          subjects = subjects.filter((s) => s.name?.toLowerCase().includes(q));
        }

        const result = subjects.map((s) => {
          const semesters =
            params.semester !== undefined ? [s.semester[params.semester]] : s.semester;
          return {
            subject: s.name,
            semesters: semesters.map((sem, i) => ({
              semester: (params.semester ?? i) + 1,
              grades: (sem?.grades ?? []).map((g) => ({
                value: g.value,
                info: g.info,
              })),
              average: sem?.average ?? null,
              tempAverage: sem?.tempAverage ?? null,
            })),
            yearAverage: s.average ?? null,
          };
        });

        return {
          details: null, content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
