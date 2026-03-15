import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getLibrusClient, invalidateSession, type Caller } from "../client/session.js";
import { scrapeInbox, scrapeInboxMessageLinks, scrapeMessageDetail, scrapeAnnouncements } from "../client/scraper.js";
import type { PluginConfig } from "../client/types.js";

// Librus inbox folder IDs
const FOLDER_RECEIVED = 5;
const FOLDER_SENT = 6;

async function scrapeInboxWithDetails(caller: Caller, folderId: number): Promise<string> {
  const inbox = await scrapeInbox(caller, folderId);
  const links = await scrapeInboxMessageLinks(caller, folderId);
  const parts = [inbox];
  for (const link of links) {
    const detail = await scrapeMessageDetail(caller, link);
    parts.push(detail);
  }
  return parts.join("\n\n---\n\n");
}

export function registerMessagesTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "get_librus_messages", label: "Librus Messages",
    description:
      "Fetch messages from the Librus Synergia inbox. " +
      "Use when the user asks about messages, emails, notifications from teachers, or inbox. " +
      "Returns a list of messages with sender, subject, and date.",
    parameters: Type.Object({
      folder: Type.Optional(
        Type.String({
          description: "Folder to read: 'received' (default) or 'sent'.",
          enum: ["received", "sent"],
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
        const folderId = params.folder === "sent" ? FOLDER_SENT : FOLDER_RECEIVED;
        const text = await scrapeInboxWithDetails(caller, folderId);
        return {
          details: null, content: [{ type: "text" as const, text }],
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
        const text = await scrapeAnnouncements(caller);
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
