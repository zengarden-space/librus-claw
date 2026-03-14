import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import type { PluginConfig } from "../client/types.js";

type RawAbsence = {
  id?: number;
  type?: string;
  date?: string;
  subject?: string;
  lessonHour?: string;
  teacher?: string;
  trip?: boolean;
};

export function registerAttendanceTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_attendance", label: "Librus Attendance",
    description:
      "Fetch student attendance records from Librus Synergia. " +
      "Use when the user asks about absences, attendance, truancy, or attendance percentage. " +
      "Returns a list of absences with subject and date, plus a summary count.",
    parameters: Type.Object({
      subject: Type.Optional(
        Type.String({
          description: "Filter by subject name (Polish, case-insensitive). Omit for all subjects.",
        }),
      ),
      type: Type.Optional(
        Type.String({
          description: "Filter by absence type, e.g. 'nb' (nieobecność), 'sp' (spóźnienie).",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);
        const raw = (await client.absence.getAbsences()) as RawAbsence[];

        let absences = raw.filter(Boolean);

        if (params.subject) {
          const q = params.subject.toLowerCase();
          absences = absences.filter((a) => a.subject?.toLowerCase().includes(q));
        }

        if (params.type) {
          const q = params.type.toLowerCase();
          absences = absences.filter((a) => a.type?.toLowerCase().includes(q));
        }

        // Group by subject for summary
        const bySubject: Record<string, number> = {};
        for (const a of absences) {
          const subj = a.subject ?? "Unknown";
          bySubject[subj] = (bySubject[subj] ?? 0) + 1;
        }

        const result = {
          total: absences.length,
          bySubject,
          absences: absences.map((a) => ({
            date: a.date,
            subject: a.subject,
            type: a.type,
            lessonHour: a.lessonHour,
            teacher: a.teacher,
            excused: a.trip ?? false,
          })),
        };

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
