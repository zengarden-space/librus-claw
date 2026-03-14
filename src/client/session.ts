import { createRequire } from "node:module";
import type { PluginConfig } from "./types.js";

const require = createRequire(import.meta.url);

type LibrusInstance = {
  authorize(username: string, password: string): Promise<void>;
  info: {
    getGrades(): Promise<unknown[]>;
    getGrade(id: number): Promise<unknown>;
    getAccountInfo(): Promise<unknown>;
    getLuckyNumber(): Promise<number>;
  };
  absence: {
    getAbsences(): Promise<unknown[]>;
    getAbsence(id: number): Promise<unknown>;
  };
  homework: {
    listSubjects(): Promise<unknown[]>;
    listHomework(subjectId: number, from: string, to: string): Promise<unknown[]>;
    getHomework(id: number): Promise<unknown>;
  };
  calendar: {
    getTimetable(from: string, to: string): Promise<unknown>;
    getCalendar(month?: number, year?: number): Promise<unknown>;
    getEvent(id: number): Promise<unknown>;
  };
  inbox: {
    listInbox(folder: number, page?: number): Promise<unknown[]>;
    getMessage(folder: number, id: number): Promise<unknown>;
    listReceivers(type: string): Promise<unknown[]>;
    listAnnouncements(): Promise<unknown[]>;
    sendMessage(userId: number, title: string, body: string): Promise<void>;
    removeMessage(id: number): Promise<void>;
  };
};

type CachedSession = {
  client: LibrusInstance;
  createdAt: number;
  ttlMs: number;
};

let cached: CachedSession | null = null;

export async function getLibrusClient(config: PluginConfig): Promise<LibrusInstance> {
  const ttlMs = (config.sessionTtlMinutes ?? 90) * 60 * 1000;
  const now = Date.now();

  if (cached && now - cached.createdAt < cached.ttlMs) {
    return cached.client;
  }

  const Librus = require("librus-api") as new () => LibrusInstance;
  const client = new Librus();
  await client.authorize(config.username, config.password);

  cached = { client, createdAt: now, ttlMs };
  return client;
}

export function invalidateSession(): void {
  cached = null;
}
