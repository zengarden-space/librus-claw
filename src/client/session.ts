import { createRequire } from "node:module";
import type { PluginConfig } from "./types.js";

const require = createRequire(import.meta.url);

/**
 * Minimal HTTP client interface extracted from librus-api's internal axios caller.
 * The caller is an axios instance with cookie jar support — all cookies are
 * preserved automatically between requests, including the Librus session cookie.
 */
export type Caller = {
  get(url: string): Promise<{ data: string; status: number }>;
  post(url: string, data: unknown): Promise<{ data: string; status: number }>;
};

type LibrusInstance = {
  _initializeCaller(): Promise<void>;
  caller: Caller;
};

type CachedSession = {
  caller: Caller;
  currentStudentId: string | null;
  createdAt: number;
  ttlMs: number;
};

const API_URL = "https://api.librus.pl";
const BASE_URL = "https://synergia.librus.pl";

let cached: CachedSession | null = null;

/**
 * Authenticate using the librus-api Librus instance's pre-configured axios caller.
 *
 * We use librus-api's internal axios+cookiejar setup but perform the OAuth flow
 * ourselves: POST login returns JSON { goTo: "<synergia URL>?code=..." } which
 * we then GET to establish the Synergia session. We skip librus-api's built-in
 * authorize() because it incorrectly appends a 2FA-skip step that causes
 * synergia.librus.pl to respond with error=invalid_request, which clears the session.
 */
async function authorize(caller: Caller, username: string, password: string): Promise<void> {
  await caller.get(
    `${API_URL}/OAuth/Authorization?client_id=46&response_type=code&scope=mydata`,
  );

  const loginResp = await caller.post(
    `${API_URL}/OAuth/Authorization?client_id=46`,
    new URLSearchParams({ action: "login", login: username, pass: password }),
  ) as unknown as { data: { status: string; goTo?: string; errors?: Array<{ message: string }> } };

  const body = loginResp.data;
  if (body.status === "error") {
    const msg = body.errors?.[0]?.message ?? "Login failed";
    throw new Error(`Librus auth error: ${msg}`);
  }

  const goTo = body.goTo;
  if (!goTo) throw new Error("Librus auth: no goTo URL in login response");

  const gotoUrl = goTo.startsWith("http") ? goTo : `${API_URL}${goTo}`;
  await caller.get(gotoUrl);
}

export async function getLibrusClient(config: PluginConfig, studentId?: string): Promise<Caller> {
  const ttlMs = (config.sessionTtlMinutes ?? 90) * 60 * 1000;
  const now = Date.now();

  if (!cached || now - cached.createdAt >= cached.ttlMs) {
    const Librus = require("librus-api") as new () => LibrusInstance;
    const instance = new Librus();
    // Constructor calls _initializeCaller() without awaiting — ensure it's ready
    if (!instance.caller) await instance._initializeCaller();
    await authorize(instance.caller, config.username, config.password);
    cached = { caller: instance.caller, currentStudentId: null, createdAt: now, ttlMs };
  }

  if (studentId && cached.currentStudentId !== studentId) {
    await cached.caller.get(`${BASE_URL}/zmien_ucznia/${studentId}`);
    cached.currentStudentId = studentId;
  }

  return cached.caller;
}

export function invalidateSession(): void {
  cached = null;
}
