import { listEvents, rangeToSince } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const events = await listEvents(env.DB, {
    event: u.searchParams.get("event") || undefined,
    visitor_id: u.searchParams.get("visitor_id") || undefined,
    sinceTs: rangeToSince(u.searchParams.get("range") || "30d"),
    limit: 300,
  });
  return Response.json({ events });
}
