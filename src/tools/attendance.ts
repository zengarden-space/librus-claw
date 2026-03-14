import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeAttendance } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

export function registerAttendanceTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_attendance", label: "Librus Attendance",
    description:
      "Fetch student attendance summary from Librus Synergia. " +
      "Use when the user asks about absences, attendance, truancy, or attendance percentage. " +
      "Returns counts of excused/unexcused absences and lateness per semester.",
    parameters: Type.Object({}),
    async execute(_id, _params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);
        const summaries = await scrapeAttendance(client.caller);
        return { details: null, content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }] };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
