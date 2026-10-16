import { getStore } from "@netlify/blobs";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { teamAccounts } from "../../db/schema.js";

export type Session = {
  idKey: string;
  name: string;
  role: string;
  accountNumber?: string;
};

export const PR_TEAM_KEYS = ["muzamil_shelby"];

export const isExecutive = (s: Session) => s.role === "ceo" || s.role === "co_exec";
export const isPrTeam = (s: Session) => PR_TEAM_KEYS.includes(s.idKey) || isExecutive(s);

// Resolves the bearer token to an active session. Rejects frozen IDs and
// sessions opened with an account number that has since been rotated out.
export async function getSession(req: Request): Promise<Session | null> {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;

  const sessionStore = getStore({ name: "admin-sessions", consistency: "strong" });
  const session = (await sessionStore.get(token, { type: "json" })) as Session | null;
  if (!session) return null;

  const freezeStore = getStore({ name: "employee-freeze", consistency: "strong" });
  const freezeState = (await freezeStore.get(session.idKey, { type: "json" })) as { isFrozen: boolean } | null;
  if (freezeState?.isFrozen) return null;

  if (session.accountNumber) {
    const [account] = await db
      .select({ id: teamAccounts.id })
      .from(teamAccounts)
      .where(and(eq(teamAccounts.accountNumber, session.accountNumber), eq(teamAccounts.status, "active")));
    if (!account) {
      await sessionStore.delete(token);
      return null;
    }
  }

  return session;
}
