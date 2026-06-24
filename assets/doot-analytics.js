// Pure, testable helpers + browser self-init. Safe to import in Node/vitest.
export function getVisitorId(store) {
  let id = store.getItem("doot_vid");
  if (!id) {
    id = (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "v-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
    store.setItem("doot_vid", id);
  }
  return id;
}

export function makeQueue() {
  let buf = [];
  return { push: (e) => buf.push(e), drain: () => { const out = buf; buf = []; return out; } };
}

// ---- browser self-init (skipped under test where there is no document) ----
if (typeof document !== "undefined") {
  const API = "/api/track";
  const store = window.localStorage;
  const visitor_id = getVisitorId(store);
  let session_id = sessionStorage.getItem("doot_sid");
  if (!session_id) { session_id = Math.random().toString(36).slice(2); sessionStorage.setItem("doot_sid", session_id); }

  const qs = new URLSearchParams(location.search), utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { if (qs.get(k)) utm[k] = qs.get(k); });

  const queue = makeQueue();
  function flush() {
    const events = queue.drain();
    if (!events.length) return;
    const payload = JSON.stringify({ visitor_id, session_id, events });
    if (navigator.sendBeacon) navigator.sendBeacon(API, new Blob([payload], { type: "application/json" }));
    else fetch(API, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
  }
  window.dootTrack = function (event, props) {
    queue.push({ event, props: props || {}, path: location.pathname, referrer: document.referrer || "direct", utm });
    if (event === "form_submit" || event === "cta_click" || event === "slot_booked") flush();
  };
  setInterval(flush, 5000);
  window.addEventListener("pagehide", flush);

  // return-visit detection
  const last = store.getItem("doot_last");
  if (last) window.dootTrack("return_visit", { since: last });
  store.setItem("doot_last", String(Date.now()));

  window.addEventListener("load", () => window.dootTrack("page_view", { referrer: document.referrer || "direct", ...utm }));
}
