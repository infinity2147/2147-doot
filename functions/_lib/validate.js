const ALLOWED = new Set([
  "page_view", "cta_click", "nav_click", "scroll_depth", "section_view",
  "faq_open", "demo_view", "demo_step", "time_on_page", "slot_booked",
  "form_start", "form_submit", "mailto_click", "return_visit",
]);

export function validateBatch(body) {
  if (!body || typeof body.visitor_id !== "string" || !body.visitor_id.trim())
    return { ok: false, error: "missing visitor_id" };
  if (!Array.isArray(body.events)) return { ok: false, error: "events must be an array" };
  if (body.events.length > 50) return { ok: false, error: "too many events" };
  const events = [];
  for (const e of body.events) {
    if (!e || !ALLOWED.has(e.event)) return { ok: false, error: "bad event: " + (e && e.event) };
    events.push({
      event: e.event,
      props: e.props && typeof e.props === "object" ? e.props : {},
      path: typeof e.path === "string" ? e.path : null,
      referrer: typeof e.referrer === "string" ? e.referrer : null,
      utm: e.utm && typeof e.utm === "object" ? e.utm : {},
    });
  }
  return { ok: true, events };
}
