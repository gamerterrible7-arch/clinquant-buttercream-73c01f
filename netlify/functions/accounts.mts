import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { teamAccounts } from "../../db/schema.js";
import { getSession, isExecutive } from "../lib/session.js";
import { ensurePermanentProfiles, rotateStaffAccounts } from "../lib/accounts.js";

export default async (req: Request) => {
  const session = await getSession(req);
  if (!session || !isExecutive(session)) {
    return Response.json({ error: "Permission Denied: CEO Cabin access required." }, { status: 403 });
  }

  if (req.method === "GET") {
    await ensurePermanentProfiles();
    const rows = await db.select().from(teamAccounts).orderBy(desc(teamAccounts.createdAt));
    return Response.json(rows);
  }

  // Manual rotation, normally handled by the monthly scheduled function.
  if (req.method === "POST") {
    if (session.role !== "ceo") {
      return Response.json({ error: "Permission Denied: Only CEO Mubashir Holmes can trigger an early ID rotation." }, { status: 403 });
    }
    await ensurePermanentProfiles();
    const rotated = await rotateStaffAccounts(`manual rotation by ${session.name}`);
    return Response.json({ rotated });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/accounts",
};
