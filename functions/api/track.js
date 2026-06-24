import { validateBatch } from "../_lib/validate.js";
import { geoFromRequest, hashIp } from "../_lib/enrich.js";
import { insertEvents } from "../_lib/db.js";
import { corsHeaders } from "../_lib/cors.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const text = await request.text();
  if (text.length > 16384) return new Response("too large", { status: 413, headers: cors });
  let body;
  try { body = JSON.parse(text); } catch { return new Response("bad json", { status: 400, headers: cors }); }
  const v = validateBatch(body);
  if (!v.ok) return new Response(v.error, { status: 400, headers: cors });

  const geo = geoFromRequest(request);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ip_hash = await hashIp(ip, env.IP_SALT || "doot");
  const ua = request.headers.get("User-Agent") || null;
  const now = Date.now();

  const rows = v.events.map((e) => ({
    ts: now, visitor_id: body.visitor_id, session_id: body.session_id || null,
    event: e.event, props: JSON.stringify(e.props || {}),
    path: e.path, referrer: e.referrer,
    utm_source: e.utm.utm_source || null, utm_medium: e.utm.utm_medium || null, utm_campaign: e.utm.utm_campaign || null,
    country: geo.country, city: geo.city, asn_org: geo.asn_org, ip_hash, ua,
  }));
  await insertEvents(env.DB, rows);
  return new Response(null, { status: 204, headers: cors });
}
