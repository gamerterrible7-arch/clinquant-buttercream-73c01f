import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { mediaItems, episodes } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getStore } from "@netlify/blobs";

async function getSession(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const sessionStore = getStore({ name: "admin-sessions", consistency: "strong" });
  const session = await sessionStore.get(token, { type: "json" }) as {
    idKey: string;
    name: string;
    role: string;
  } | null;

  if (!session) return null;

  // Double check if employee ID was frozen in the meantime
  const freezeStore = getStore({ name: "employee-freeze", consistency: "strong" });
  const freezeState = await freezeStore.get(session.idKey, { type: "json" }) as { isFrozen: boolean } | null;

  if (freezeState && freezeState.isFrozen) {
    return null;
  }

  return session;
}

export default async (req: Request) => {
  if (req.method === "GET") {
    const items = await db.select().from(mediaItems).orderBy(mediaItems.createdAt);
    const eps = await db.select().from(episodes);

    const result = items.map((item) => ({
      ...item,
      content: eps
        .filter((ep) => ep.mediaItemId === item.id)
        .sort((a, b) => a.season - b.season || a.episode - b.episode)
        .map((ep) => ({ season: ep.season, episode: ep.episode, name: ep.name, url: ep.url })),
    }));

    return Response.json(result);
  }

  // Mutating requests require session auth
  const session = await getSession(req);
  if (!session) {
    return Response.json({ error: "Unauthorized: Active, non-frozen admin session required." }, { status: 401 });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { type, title, genre, creator, description, thumbnail, content } = body;

    if (!type || !title || !genre || !creator) {
      return Response.json({ error: "Missing required fields: Title, Genre, and Creator are required." }, { status: 400 });
    }

    const [item] = await db
      .insert(mediaItems)
      .values({
        type,
        title,
        genre,
        creator,
        description: description || "No description provided.",
        thumbnail: thumbnail || "",
      })
      .returning();

    if (Array.isArray(content) && content.length > 0) {
      await db.insert(episodes).values(
        content.map((ep: { season: number; episode: number; name?: string; url: string }) => ({
          mediaItemId: item.id,
          season: ep.season || 1,
          episode: ep.episode || 1,
          name: ep.name || "",
          url: ep.url || "",
        }))
      );
    }

    return Response.json(item, { status: 201 });
  }

  if (req.method === "PATCH") {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");

    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json();
    const { type, title, genre, creator, description, thumbnail, content } = body;

    const updates: Record<string, string> = {};
    if (type !== undefined) updates.type = type;
    if (title !== undefined) updates.title = title;
    if (genre !== undefined) updates.genre = genre;
    if (creator !== undefined) updates.creator = creator;
    if (description !== undefined) updates.description = description;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;

    if (Object.keys(updates).length > 0) {
      await db.update(mediaItems).set(updates).where(eq(mediaItems.id, id));
    }

    if (Array.isArray(content)) {
      await db.delete(episodes).where(eq(episodes.mediaItemId, id));
      if (content.length > 0) {
        await db.insert(episodes).values(
          content.map((ep: { season: number; episode: number; name?: string; url: string }) => ({
            mediaItemId: id,
            season: ep.season || 1,
            episode: ep.episode || 1,
            name: ep.name || "",
            url: ep.url || "",
          }))
        );
      }
    }

    return new Response(null, { status: 204 });
  }

  if (req.method === "DELETE") {
    // Only CEO Mubashir Holmes and Hassan Nolan can delete assets!
    if (session.role === "employee") {
      return Response.json({
        error: "Permission Denied: Deletion requires CEO Mubashir Holmes or Hassan Nolan executive authorization."
      }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");

    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    await db.delete(episodes).where(eq(episodes.mediaItemId, id));
    await db.delete(mediaItems).where(eq(mediaItems.id, id));

    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/catalog",
};
