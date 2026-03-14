import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { registerGradesTools } from "./src/tools/grades.js";
import { registerAttendanceTools } from "./src/tools/attendance.js";
import { registerHomeworkTools } from "./src/tools/homework.js";
import { registerTimetableTools } from "./src/tools/timetable.js";
import { registerMessagesTools } from "./src/tools/messages.js";

const plugin: {
  id: string;
  name: string;
  description: string;
  configSchema: ReturnType<typeof emptyPluginConfigSchema>;
  register(api: OpenClawPluginApi): void;
} = {
  id: "librus-claw",
  name: "Librus Claw",
  description: "Access Librus Synergia school data: grades, attendance, homework, timetable, messages.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    registerGradesTools(api);
    registerAttendanceTools(api);
    registerHomeworkTools(api);
    registerTimetableTools(api);
    registerMessagesTools(api);
  },
};

export default plugin;
