import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession } from "../client/session.js";
import type { PluginConfig } from "../client/types.js";

type RawMessage = {
  id: number;
  user: string;
  title: string;
  date: string;
  read: boolean;
};

// Librus inbox folder IDs
const FOLDER_RECEIVED = 5;
const FOLDER_SENT = 6;

export function registerMessagesTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_messages", label: "Librus Messages",
    description:
      "Fetch messages from the Librus Synergia inbox. " +
      "Use when the user asks about messages, emails, notifications from teachers, or inbox. " +
      "Returns a list of messages with sender, subject, and date.",
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of messages to return. Default: 10.",
        }),
      ),
      unread_only: Type.Optional(
        Type.Boolean({
          description: "If true, return only unread messages.",
        }),
      ),
      folder: Type.Optional(
        Type.String({
          description: "Folder to read: 'received' (default) or 'sent'.",
          enum: ["received", "sent"],
        }),
      ),
    }),
    async execute(_id, params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);

        const folderId = params.folder === "sent" ? FOLDER_SENT : FOLDER_RECEIVED;
        const raw = (await client.inbox.listInbox(folderId)) as RawMessage[];

        let messages = raw.filter(Boolean);

        if (params.unread_only) {
          messages = messages.filter((m) => !m.read);
        }

        const limit = params.limit ?? 10;
        messages = messages.slice(0, limit);

        const result = messages.map((m) => ({
          id: m.id,
          from: m.user,
          subject: m.title,
          date: m.date,
          read: m.read,
          folder: folderId === FOLDER_RECEIVED ? "received" : "sent",
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

  api.registerTool({
    name: "get_librus_announcements", label: "Librus Announcements",
    description:
      "Fetch school announcements from Librus Synergia. " +
      "Use when the user asks about announcements, school news, or notices.",
    parameters: Type.Object({}),
    async execute(_id, _params) {
      const cfg = api.pluginConfig as PluginConfig;
      try {
        const client = await getLibrusClient(cfg);
        const raw = await client.inbox.listAnnouncements();

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
