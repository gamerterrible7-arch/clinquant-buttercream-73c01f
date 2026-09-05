import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const EMPLOYEES = [
  { idKey: "mubashir_holmes", name: "CEO Mubashir Holmes", role: "ceo" },
  { idKey: "hassan_nolan", name: "Hassan Nolan", role: "co_exec" },
  { idKey: "abdullah_cruise", name: "Abdullah Cruise", role: "employee" },
  { idKey: "muzamil_shelby", name: "Muzamil Shelby", role: "employee" },
  { idKey: "saba_ahmad", name: "Saba Ahmad", role: "employee" }
];

async function getSession(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const sessionStore = getStore({ name: "admin-sessions", consistency: "strong" });
  const session = await sessionStore.get(token, { type: "json" }) as { idKey: string; name: string; role: string } | null;
  return session;
}

export default async (req: Request) => {
  const session = await getSession(req);
  if (!session) {
    return Response.json({ error: "Unauthorized: Invalid or expired session." }, { status: 401 });
  }

  const freezeStore = getStore({ name: "employee-freeze", consistency: "strong" });

  if (req.method === "GET") {
    // List employees and their freeze status
    const list = await Promise.all(
      EMPLOYEES.map(async (emp) => {
        const freezeState = (await freezeStore.get(emp.idKey, { type: "json" })) as {
          isFrozen: boolean;
          frozenBy: string;
          frozenAt?: number;
        } | null;

        return {
          idKey: emp.idKey,
          name: emp.name,
          role: emp.role,
          isFrozen: freezeState ? !!freezeState.isFrozen : false,
          frozenBy: freezeState ? freezeState.frozenBy : null
        };
      })
    );

    return Response.json({
      currentUser: session,
      employees: list
    });
  }

  if (req.method === "POST") {
    // Freeze or Unfreeze action
    const body = await req.json();
    const { targetIdKey, action } = body; // action: "freeze" | "unfreeze"

    if (!targetIdKey || (action !== "freeze" && action !== "unfreeze")) {
      return Response.json({ error: "Invalid target or action parameter" }, { status: 400 });
    }

    const targetEmp = EMPLOYEES.find((e) => e.idKey === targetIdKey);
    if (!targetEmp) {
      return Response.json({ error: "Target employee ID not found" }, { status: 404 });
    }

    // Permission checks based on hierarchy
    if (session.role === "employee") {
      return Response.json({
        error: "Permission Denied: Only CEO Mubashir Holmes and Hassan Nolan can manage employee ID freeze statuses."
      }, { status: 403 });
    }

    const currentFreezeState = (await freezeStore.get(targetIdKey, { type: "json" })) as {
      isFrozen: boolean;
      frozenBy: string;
    } | null;

    if (action === "freeze") {
      // Rule: Hassan Nolan CANNOT freeze CEO Mubashir Holmes's ID
      if (session.role === "co_exec" && targetEmp.role === "ceo") {
        return Response.json({
          error: "Permission Denied: Hassan Nolan is not authorized to freeze CEO Mubashir Holmes's ID."
        }, { status: 403 });
      }

      await freezeStore.setJSON(targetIdKey, {
        isFrozen: true,
        frozenBy: session.idKey,
        frozenAt: Date.now()
      });

      return Response.json({
        success: true,
        message: `Employee ID for ${targetEmp.name} has been successfully FROZEN.`
      });
    }

    if (action === "unfreeze") {
      // Rule: Hassan Nolan CANNOT unfreeze IDs frozen by CEO Mubashir Holmes
      if (
        session.role === "co_exec" &&
        currentFreezeState &&
        currentFreezeState.frozenBy === "mubashir_holmes"
      ) {
        return Response.json({
          error: "Permission Denied: Hassan Nolan is not authorized to unfreeze an ID frozen by CEO Mubashir Holmes."
        }, { status: 403 });
      }

      await freezeStore.setJSON(targetIdKey, {
        isFrozen: false,
        frozenBy: null,
        frozenAt: null
      });

      return Response.json({
        success: true,
        message: `Employee ID for ${targetEmp.name} has been successfully UNFORZEN.`
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/employees",
};
