import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response("Missing asset key", { status: 400 });
  }

  try {
    const blobStore = getStore({ name: "app-assets", consistency: "strong" });
    const result = await blobStore.getWithMetadata(key, { type: "arrayBuffer" });

    if (!result) {
      return new Response("Asset not found", { status: 404 });
    }

    const metadata = result.metadata || {};
    const contentType = (metadata as any).contentType || (key.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

    return new Response(result.data as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentType.includes("pdf") ? "inline" : "inline",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (err: any) {
    return new Response(err.message || "Failed to retrieve asset", { status: 500 });
  }
};

export const config: Config = {
  path: "/api/blob",
};
