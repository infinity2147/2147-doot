import { companyFromEmail } from "../_lib/domain.js";
import { geoFromRequest } from "../_lib/enrich.js";
import { insertEvents, eventsForVisitor, insertLead } from "../_lib/db.js";
import { intentScore } from "../_lib/intent.js";
import { corsHeaders } from "../_lib/cors.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.email)
    return new Response("name and email required", { status: 400, headers: cors });

  const { company } = companyFromEmail(body.email);
  const geo = geoFromRequest(request);
  const now = Date.now();
  const visitor_id = body.visitor_id || null;

  if (visitor_id) {
    await insertEvents(env.DB, [{
      ts: now, visitor_id, session_id: body.session_id || null, event: "form_submit",
      props: JSON.stringify({}), path: body.path || null, referrer: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      country: geo.country, city: geo.city, asn_org: geo.asn_org, ip_hash: null, ua: null,
    }]);
  }

  const evs = visitor_id ? await eventsForVisitor(env.DB, visitor_id) : [{ event: "form_submit", props: {} }];
  const { score } = intentScore(evs.map((e) => ({ event: e.event, props: JSON.parse(e.props || "{}") })));

  const id = await insertLead(env.DB, {
    ts: now, visitor_id, name: body.name, email: body.email, company,
    message: body.message || null, status: "new", intent_score: score,
    country: geo.country, city: geo.city, asn_org: geo.asn_org,
  });
  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200, headers: { "Content-Type": "application/json", ...cors },
  });
}
