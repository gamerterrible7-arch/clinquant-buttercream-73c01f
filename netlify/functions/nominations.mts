import type { Config } from "@netlify/functions";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { nominations } from "../../db/schema.js";
import { getSession, isExecutive, isPrTeam } from "../lib/session.js";
import { issueAccount } from "../lib/accounts.js";

const clean = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async (req: Request) => {
  const session = await getSession(req);
  if (!session) {
    return Response.json({ error: "Unauthorized: Active admin session required." }, { status: 401 });
  }

  if (req.method === "GET") {
    if (!isPrTeam(session)) {
      return Response.json({ error: "Permission Denied: PR Team or CEO Cabin access required." }, { status: 403 });
    }
    // Executives see the whole queue; the PR Team sees its own submissions.
    const rows = isExecutive(session)
      ? await db.select().from(nominations).orderBy(desc(nominations.createdAt))
      : await db.select().from(nominations).where(eq(nominations.submittedBy, session.name)).orderBy(desc(nominations.createdAt));
    return Response.json(rows);
  }

  if (req.method === "POST") {
    if (!isPrTeam(session)) {
      return Response.json({ error: "Permission Denied: Only Muzamil Shelby's PR Team can submit nominations." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const candidateName = clean(body.candidateName, 120);
    const proposedRole = clean(body.proposedRole, 120);
    if (!candidateName || !proposedRole) {
      return Response.json({ error: "Candidate name and proposed role are required." }, { status: 400 });
    }

    const [row] = await db
      .insert(nominations)
      .values({
        candidateName,
        proposedRole,
        email: clean(body.email, 200),
        phone: clean(body.phone, 50),
        details: clean(body.details),
        submittedBy: session.name,
      })
      .returning();
    return Response.json(row, { status: 201 });
  }

  if (req.method === "PATCH") {
    if (!isExecutive(session)) {
      return Response.json({ error: "Permission Denied: Only CEO Mubashir Holmes and Hassan Nolan can review nominations." }, { status: 403 });
    }
    const id = parseInt(new URL(req.url).searchParams.get("id") || "");
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!id || (action !== "approve" && action !== "reject")) {
      return Response.json({ error: "A nomination id and an action of approve or reject are required." }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // The status guard makes the decision atomic: a nomination can only be reviewed once.
      const [nomination] = await tx
        .update(nominations)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          reviewedBy: session.name,
          reviewNote: clean(body.note, 500),
          reviewedAt: new Date(),
        })
        .where(and(eq(nominations.id, id), eq(nominations.status, "pending")))
        .returning();
      if (!nomination) return null;

      const account =
        action === "approve"
          ? await issueAccount(
              {
                memberKey: `nominee_${nomination.id}`,
                memberName: nomination.candidateName,
                title: nomination.proposedRole,
                role: "employee",
                nominationId: nomination.id,
                issuedBy: session.name,
              },
              tx
            )
          : null;
      return { nomination, account };
    });

    if (!result) {
      return Response.json({ error: "Nomination not found or already reviewed." }, { status: 409 });
    }
    return Response.json(result);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/nominations",
};
