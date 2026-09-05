import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

async function getSession(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const sessionStore = getStore({ name: "admin-sessions", consistency: "strong" });
  return (await sessionStore.get(token, { type: "json" })) as {
    idKey: string;
    name: string;
    role: string;
  } | null;
}

export default async (req: Request) => {
  const bannerStore = getStore({ name: "promotional-banners", consistency: "strong" });

  if (req.method === "GET") {
    const listResult = await bannerStore.list();
    const banners = await Promise.all(
      listResult.blobs.map(async (b) => {
        return await bannerStore.get(b.key, { type: "json" });
      })
    );
    const validBanners = banners.filter(Boolean).sort((a: any, b: any) => b.createdAt - a.createdAt);
    return Response.json(validBanners);
  }

  if (req.method === "POST") {
    const session = await getSession(req);
    if (!session) {
      return Response.json({ error: "Unauthorized: Admin session required." }, { status: 401 });
    }

    const body = await req.json();
    const { title, subtitle, imageUrl, section, badgeText } = body;

    if (!title || !imageUrl) {
      return Response.json({ error: "Title and Image URL are required for promotional banners." }, { status: 400 });
    }

    const id = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const bannerData = {
      id,
      title,
      subtitle: subtitle || "",
      imageUrl,
      section: section || "movies",
      badgeText: badgeText || "NEW RELEASE",
      createdBy: session.name,
      createdAt: Date.now()
    };

    await bannerStore.setJSON(id, bannerData);
    return Response.json(bannerData, { status: 201 });
  }

  if (req.method === "DELETE") {
    const session = await getSession(req);
    if (!session) {
      return Response.json({ error: "Unauthorized: Admin session required." }, { status: 401 });
    }

    if (session.role === "employee") {
      return Response.json({ error: "Permission Denied: Only CEO Mubashir Holmes and Hassan Nolan can delete promotional banners." }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Missing banner id" }, { status: 400 });
    }

    await bannerStore.delete(id);
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/banners",
};
