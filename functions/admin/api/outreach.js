import { listOutreach, importOutreach } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const status = new URL(request.url).searchParams.get("status") || undefined;
  return Response.json({ items: await listOutreach(env.DB, status) });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return new Response("items[] required", { status: 400 });
  const inserted = await importOutreach(env.DB, body.items);
  return Response.json({ ok: true, inserted, received: body.items.length });
}
