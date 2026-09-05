import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: ArrayBuffer | null = null;
    let filename = "";
    let mimeType = "application/pdf";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("file") || formData.get("pdf")) as File | null;
      if (!file) {
        return Response.json({ error: "No file uploaded" }, { status: 400 });
      }
      filename = file.name;
      mimeType = file.type || "application/pdf";
      fileBuffer = await file.arrayBuffer();
    } else {
      const body = await req.json();
      if (!body.base64) {
        return Response.json({ error: "Missing base64 file payload" }, { status: 400 });
      }
      filename = body.filename || "file.pdf";
      mimeType = body.mimeType || "application/pdf";
      const binaryString = atob(body.base64.split(",").pop() || "");
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    }

    const key = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const blobStore = getStore({ name: "app-assets", consistency: "strong" });

    await blobStore.set(key, fileBuffer, {
      metadata: {
        contentType: mimeType,
        originalName: filename
      }
    });

    const fileUrl = `/api/blob?key=${encodeURIComponent(key)}`;

    return Response.json({
      success: true,
      key,
      url: fileUrl,
      filename
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/upload",
};
