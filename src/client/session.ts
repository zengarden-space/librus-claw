import { createRequire } from "node:module";
import type { PluginConfig } from "./types.js";

const require = createRequire(import.meta.url);

const API_URL = "https://api.librus.pl";

type LibrusInstance = {
  authorize(username: string, password: string): Promise<void>;
  caller: {
    get(url: string): Promise<{ data: string; status: number }>;
    post(url: string, data: unknown): Promise<{ data: string; status: number }>;
  };
  cookie: {
    setCookie(cookie: string, url: string): void;
    getCookies(url: string): Promise<Array<{ key: string; value: string }>>;
  };
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

/**
 * Authenticate using the librus-apix approach:
 * POST login → follow goTo URL → extract DZIENNIKSID + SDZIENNIKSID cookies.
 * This avoids the broken 2FA/Grant redirect steps in librus-api's own authorize().
 */
async function authorizeFixed(client: LibrusInstance, username: string, password: string): Promise<void> {
  // Ensure caller is initialized (librus-api does this lazily)
  await client.caller.get(`${API_URL}/OAuth/Authorization?client_id=46&response_type=code&scope=mydata`);

  const loginResp = await (client.caller.post as (url: string, data: unknown) => Promise<{ data: unknown }>)(
    `${API_URL}/OAuth/Authorization?client_id=46`,
    new URLSearchParams({ action: "login", login: username, pass: password }),
  ) as { data: { status: string; goTo?: string; errors?: Array<{ message: string }> } };

  const body = loginResp.data;
  if (body.status === "error") {
    const msg = body.errors?.[0]?.message ?? "Login failed";
    throw new Error(`Librus auth error: ${msg}`);
  }

  const goTo = body.goTo;
  if (!goTo) throw new Error("Librus auth: no goTo URL in login response");

  // Follow the redirect — this sets DZIENNIKSID + SDZIENNIKSID on synergia.librus.pl
  const gotoUrl = goTo.startsWith("http") ? goTo : `${API_URL}${goTo}`;
  await client.caller.get(gotoUrl);
}

export async function getLibrusClient(config: PluginConfig): Promise<LibrusInstance> {
  const ttlMs = (config.sessionTtlMinutes ?? 90) * 60 * 1000;
  const now = Date.now();

  if (cached && now - cached.createdAt < cached.ttlMs) {
    return cached.client;
  }

  const Librus = require("librus-api") as new () => LibrusInstance;
  const client = new Librus();
  // _initializeCaller is async but not awaited in the constructor — force it here
  await (client as unknown as { _initializeCaller(): Promise<void> })._initializeCaller();
  await authorizeFixed(client, config.username, config.password);

  cached = { client, createdAt: now, ttlMs };
  return client;
}

export function invalidateSession(): void {
  cached = null;
}
