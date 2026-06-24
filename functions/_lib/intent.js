export function intentScore(events) {
  let pricingFaq = false, anyFaq = false, maxDemo = -1, maxScroll = 0, maxTime = 0;
  let returned = false, cta = false, submitted = false;
  for (const ev of events || []) {
    const p = ev.props || {};
    switch (ev.event) {
      case "faq_open":
        anyFaq = true;
        if (/(price|cost)/i.test(p.q || "")) pricingFaq = true;
        break;
      case "demo_step": maxDemo = Math.max(maxDemo, Number(p.step) || 0); break;
      case "scroll_depth": maxScroll = Math.max(maxScroll, Number(p.percent) || 0); break;
      case "time_on_page": maxTime = Math.max(maxTime, Number(p.seconds) || 0); break;
      case "return_visit": returned = true; break;
      case "cta_click": cta = true; break;
      case "form_submit": submitted = true; break;
    }
  }
  let s = 0;
  if (pricingFaq) s += 30; else if (anyFaq) s += 10;
  if (maxDemo >= 2) s += 15;
  if (maxScroll >= 100) s += 15;
  if (maxTime > 120) s += 20;
  if (returned) s += 25;
  if (cta) s += 20;
  if (submitted) s += 100;
  const bucket = s >= 71 ? "hot" : s >= 31 ? "warm" : "cold";
  return { score: s, bucket };
}
