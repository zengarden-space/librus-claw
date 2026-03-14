import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import type { PluginConfig } from "../client/types.js";

type RawSubject = {
  id: number;
  name: string;
};

type RawHomework = {
  id: number;
  subject: string;
  user: string;
  title: string;
  type: string;
  from: string;
  to: string;
  status: string;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function registerHomeworkTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_homework", label: "Librus Homework",
    description:
      "Fetch upcoming homework assignments from Librus Synergia. " +
      "Use when the user asks about homework, assignments, tasks, or what to study. " +
      "Returns assignments sorted by due date.",
    parameters: Type.Object({
      days: Type.Optional(
        Type.Number({
          description: "Number of days ahead to look for homework. Default: 7.",
        }),
      ),
      subject: Type.Optional(
        Type.String({
          description: "Filter by subject name (Polish, case-insensitive). Omit for all subjects.",
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);

        const today = new Date();
        const until = new Date(today);
        until.setDate(today.getDate() + (params.days ?? 7));

        const from = formatDate(today);
        const to = formatDate(until);

        // Get all subjects first, then fetch homework for each
        const subjects = (await client.homework.listSubjects()) as RawSubject[];
        const filtered = params.subject
          ? subjects.filter((s) => s.name?.toLowerCase().includes(params.subject!.toLowerCase()))
          : subjects;

        const allHomework: RawHomework[] = [];
        for (const subj of filtered) {
          if (!subj.id) continue;
          try {
            const hw = (await client.homework.listHomework(subj.id, from, to)) as RawHomework[];
            allHomework.push(...hw.filter(Boolean));
          } catch {
            // some subjects may have no homework endpoint
          }
        }

        // Sort by due date
        allHomework.sort((a, b) => (a.to ?? "").localeCompare(b.to ?? ""));

        const result = allHomework.map((h) => ({
          subject: h.subject,
          title: h.title,
          type: h.type,
          assignedDate: h.from,
          dueDate: h.to,
          status: h.status,
          teacher: h.user,
        }));

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
