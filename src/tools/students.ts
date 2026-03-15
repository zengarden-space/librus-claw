import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import { scrapeStudentList } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

export function registerStudentsTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_students", label: "Librus Students",
    description:
      "List all students linked to the Librus parent account. " +
      "Use this first when the user asks about a specific child or to check which students are in the account. " +
      "Returns student names and IDs. Pass a student ID as the 'student' parameter to other tools to fetch data for a specific child.",
    parameters: Type.Object({}),
    async execute(_id, _params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const caller = await getLibrusClient(cfg);
        const students = await scrapeStudentList(caller);
        return { details: null, content: [{ type: "text" as const, text: JSON.stringify(students, null, 2) }] };
      } catch (err) {
        invalidateSession();
        throw err;
      }
    },
  });
}
