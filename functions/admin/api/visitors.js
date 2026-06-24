import { listVisitors, eventsForVisitor, rangeToSince } from "../../_lib/db.js";
import { intentScore } from "../../_lib/intent.js";

export async function onRequestGet({ request, env }) {
  const range = new URL(request.url).searchParams.get("range") || "7d";
  const visitors = await listVisitors(env.DB, rangeToSince(range));
  const out = [];
  for (const v of visitors) {
    const evs = await eventsForVisitor(env.DB, v.visitor_id);
    const intent = intentScore(evs.map((e) => ({ event: e.event, props: JSON.parse(e.props || "{}") })));
    out.push({ ...v, intent });
  }
  return Response.json({ visitors: out });
}
