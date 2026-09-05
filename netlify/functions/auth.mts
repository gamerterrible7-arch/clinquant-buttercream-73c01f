import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Allowed employee identities matching PDF IDs
const KNOWN_EMPLOYEES = [
  {
    idKey: "mubashir_holmes",
    name: "CEO Mubashir Holmes",
    role: "ceo",
    keywords: ["mubashir", "holmes", "ceo"]
  },
  {
    idKey: "hassan_nolan",
    name: "Hassan Nolan",
    role: "co_exec",
    keywords: ["hassan", "nolan"]
  },
  {
    idKey: "abdullah_cruise",
    name: "Abdullah Cruise",
    role: "employee",
    keywords: ["abdullah", "cruise"]
  },
  {
    idKey: "muzamil_shelby",
    name: "Muzamil Shelby",
    role: "employee",
    keywords: ["muzamil", "shelby"]
  },
  {
    idKey: "saba_ahmad",
    name: "Saba Ahmad",
    role: "employee",
    keywords: ["saba", "ahmad"]
  }
];

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let filename = "";
    let fileText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("idPdf") as File | null;
      if (!file) {
        return Response.json({ success: false, error: "No PDF file uploaded" }, { status: 400 });
      }
      filename = file.name.toLowerCase();
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder("latin1");
      fileText = decoder.decode(buffer).toLowerCase();
    } else {
      const body = await req.json().catch(() => ({}));
      filename = (body.filename || "").toLowerCase();
      fileText = (body.fileData || "").toLowerCase();
    }

    if (!filename.endsWith(".pdf") && !contentType.includes("pdf") && !fileText.includes("%pdf")) {
      return Response.json({ success: false, error: "Invalid format: ID must be a PDF document uploaded directly from storage." }, { status: 400 });
    }

    // Match identity from filename and PDF content
    let matchedEmp = KNOWN_EMPLOYEES.find(emp => 
      emp.keywords.every(kw => filename.includes(emp.idKey) || filename.includes(kw))
    );

    if (!matchedEmp) {
      matchedEmp = KNOWN_EMPLOYEES.find(emp => 
        emp.keywords.some(kw => filename.includes(kw) || fileText.includes(kw))
      );
    }

    if (!matchedEmp) {
      return Response.json({ 
        success: false, 
        error: "Unrecognized Employee ID. Please upload a valid official Employee ID PDF document." 
      }, { status: 401 });
    }

    // Check freeze status in Netlify Blobs
    const freezeStore = getStore({ name: "employee-freeze", consistency: "strong" });
    const freezeState = await freezeStore.get(matchedEmp.idKey, { type: "json" }) as { isFrozen: boolean; frozenBy: string } | null;

    if (freezeState && freezeState.isFrozen) {
      return Response.json({
        success: false,
        error: `ACCESS DENIED: Employee ID for ${matchedEmp.name} has been FROZEN by management (${freezeState.frozenBy === "mubashir_holmes" ? "CEO Mubashir Holmes" : "Hassan Nolan"}).`
      }, { status: 403 });
    }

    // Create session token
    const token = `${matchedEmp.idKey}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionStore = getStore({ name: "admin-sessions", consistency: "strong" });
    await sessionStore.setJSON(token, {
      idKey: matchedEmp.idKey,
      name: matchedEmp.name,
      role: matchedEmp.role,
      createdAt: Date.now()
    });

    const isManagement = matchedEmp.role === "ceo" || matchedEmp.role === "co_exec";

    return Response.json({
      success: true,
      token,
      employee: {
        idKey: matchedEmp.idKey,
        name: matchedEmp.name,
        role: matchedEmp.role
      },
      permissions: {
        canDelete: isManagement,
        canFreeze: isManagement,
        canAddEdit: true
      }
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || "Authentication error" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/auth",
};
