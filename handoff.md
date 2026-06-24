# Doot — Project Handoff

**What this is:** an autonomous AI sales agent (AI SDR), sold as a done-for-you service to B2B companies. Wedge = outbound sales; expandable to "any agent" later.
**Owner:** Anant Asati (IIT Bombay) · **Contact:** asatianant2678@gmail.com
**Last updated:** 24 Jun 2026

---

## 1. The product in one line
Doot finds the companies that fit you, reaches the person who can say yes, writes a real (non-template) email, sends it from your inbox, and follows up until there's a reply — so a pipeline fills without adding headcount.

**The core wedge / unfair advantage:** *sell the agent by using the agent.* Every outreach email says "this message was researched, written, and sent by the same agent we'd build you." The outreach IS the demo. Never bury this line.

**Brand:** "Doot" (no "AI" suffix). Tagline: *The messenger for modern sales.*
Story: a *dūta* is the trusted envoy; Hanuman as *Ramdoot* crossed an ocean, found the one person who mattered, delivered the message, and returned with the answer — finds / carries / never returns empty → discovery / personalized outreach / follow-up.

---

## 2. Go-to-market decisions (made)

### Who to target (priority order)
1. **B2B agencies & service firms first** — start with **recruiting/staffing** and **B2B lead-gen agencies**. Why: outbound pain is daily and obvious (no education needed), non-technical owners don't say "we'll DIY it," fast single-decision-maker sales, and they can **white-label Doot to their own clients** (one sale = a channel).
2. **Seed / Series A B2B SaaS** — fast, AI-native, founder-led; but more "we'll build it ourselves" objections.
3. **Product / manufacturing B2B** — biggest budgets but slowest, least AI-native, hardest buyer to reach. Come back once there are reference logos.

Start narrow: one segment for the first ~25–30 emails. Narrow = better personalization = higher reply rate = faster proof.

### Where
**Learn in India, earn in the US.** India: reachable, same timezone, trust builds faster, forgiving while the agent is still being tuned (lower $/deal). US: pays multiples more and has the deepest AI-SDR appetite, but crowded (11x, Artisan, Clay) and cold-trust is harder for an unknown overseas vendor. Sequence: land 2–3 Indian reference logos → then point the agent at US agencies. Don't split focus in batch one.

### Who inside the company (persona)
- < 30 people → Founder / CEO
- 30–200 → VP Sales / Head of Sales / Head of Growth / CRO
- RevOps / Sales Ops = champion/influencer, not the buyer
- Avoid junior SDRs (no budget) and generic info@ inboxes.

### Pricing
Decide live on the call (likely a small **setup fee + monthly run**, or **per-meeting-booked**). Keep the CTA interest-based so nothing depends on price being set.

---

## 3. Method (borrowed from the Tanay / Wispr Flow interview)
- Their discovery engine ran on **product-usage data** (which power-user inside an enterprise to target). We have no usage data when cold, so the cold-start equivalent is **trigger events**: companies hiring SDRs/BDRs, recently funded, visibly scaling sales. Filter on these — biggest single lever on reply rate.
- **Human-in-the-loop before automation.** Send the first ~25–30 semi-manually, read every reply, learn what lands per persona, *then* systematize. Don't fully automate batch one.
- **Persona-specific angles** (same product, different pain): agency owner → "more client meetings without more headcount"; SaaS founder → "pipeline before you can afford an SDR."

---

## 4. Outreach playbook

### Pull the list (Apollo — run this, export ~30)
- Titles: Founder, Co-founder, CEO, Owner, Managing Director, Head of Sales, Head of Growth
- Headcount: 2–50 (boutique = fast decisions)
- Keywords/industry: Staffing & Recruiting, Lead Generation, Sales Outsourcing, Demand Generation, B2B Marketing Agency
- Location: India (Bangalore, Mumbai, Delhi NCR, Pune to start)
- Email status: **Verified only**
- Bonus: companies with open SDR/BDR/Recruiter job postings (the "outbound problem right now" signal)

> Hand the exported CSV back to Claude → it drafts a personalized email per row + loads a verification tracker (company, contact, email, draft, approve Y/N, sent, reply).

### The email (rules)
Under ~80 words · readable on a phone in 10s · about them · one pain, one proof, one soft CTA · subject 2–4 words. The "this email was sent by the agent" line is the hook.

**Recruiting-agency owner**
> **Subject:** quick one for [Agency]
> Hi [First name],
> Saw [Agency]'s hiring for BD roles — usually a sign outbound's eating your team's time.
> We build an AI sales agent that finds the right contacts, personalizes every email, sends, and follows up on its own. This email? Written and sent by that agent.
> For a staffing firm that means more client meetings without adding headcount.
> Worth a 10-min look?
> [Name] — AI engineer, IIT Bombay

**Lead-gen agency founder (white-label hook)**
> **Subject:** your outbound, on autopilot
> Hi [First name],
> [Agency] sells outbound for a living — so you know how much research + writing goes into emails that still get ignored.
> We build an AI agent that does discovery, personalizes, sends, and follows up. You could even run it for your own clients under your brand.
> This message was sent by that agent.
> Open to a quick look?
> [Name]

### Follow-ups
2–3, spaced 3–4 days, each adding something (a relevant result, a 30-sec Loom of the agent working). Never just "bumping this."

### Deliverability — set up BEFORE sending anything
- Dedicated sending **domain** (not the main one) + **SPF / DKIM / DMARC**
- **2–3 week inbox warmup**, then ramp slowly (~10–15/day, not 30 at once)
- No attachment on first touch; clear sender identity + opt-out
- **Do not attach the resume.** A full academic CV reads "student" and trips spam. Bake the credible subset into the site + one email line instead (see §6).

---

## 5. Founder credibility (use the relevant subset only)
Anant Asati — IIT Bombay (IEOR + CS minor). Has shipped production-grade agentic systems:
- **Debt Collection Agent Trainer** (Prodigal GenAI hackathon, runner-up) — voice agent + compliance scoring
- **Broker CoPilot** (Marsh McLennan × Techfest) — compliant AI copilot, stateless orchestration
- **Birbal** — multi-agent travel assistant (primary agent delegating to sub-agents)

Frame as: "Built by an engineer from IIT Bombay who's shipped multi-agent orchestration, real-time voice agents, and compliance-aware copilots." Don't name hackathon partners as "clients."

---

## 6. The website — `doot.html`
Single self-contained HTML file (light theme). Hosting: drop on any static host; works offline too.

### Design rationale (research-backed)
- **One focused page, one repeated CTA, no off-site nav.** Single-CTA pages convert ~29% better than multi-CTA.
- **Navy = trust (dominant), saffron/ember = the single high-contrast action color** (CTA + the signature arc only). Blue is the B2B trust standard; a warm contrasting CTA converts; the action color should be the only element using that color.
- **Figures/direction:** the hero "leap" arc points at the decision-maker it reaches; real founder photo slot left in place (a real face out-converts a graphic).
- **Words:** specific, plain, low-commitment, first-person; risk-reducer under every CTA ("10 minutes, no deck, no obligation").
- **Trust + risk:** FAQ kills objections (spam? switch tools? cost?); trust strip; logo/testimonial slots left **empty on purpose** — fabricated proof loses B2B buyers. Add real ones when available.
- **Forms:** when you add one, name + email only (≤5 fields ≈ +120%).

### Tokens
- Colors: paper `#F6F8FC`, navy/ink `#0F1635`, ember `#EC7D1E` (accent text `#B85F0C`)
- Fonts: Instrument Serif (display), Plus Jakarta Sans (body), IBM Plex Mono (labels)

### Sections
Hero (dogfooding headline) → trust strip → Why Doot (the dūta story) → **How it works (animated walkthrough)** → Why it works + founder credibility → FAQ → Beyond sales → final CTA → footer.

### Animated walkthrough (the "video")
In **How it works**: a self-playing, looping explainer — Find (scan locks onto the matching company) → Reach (email types itself, sends, plane flies, "Delivered ✓") → Follow up (Day 0/3/7 timeline) → Hand off (warm reply → "You" closes). Auto-advances ~4.6s/step, clickable tabs, Pause/Play, plays only when on-screen, respects reduced-motion.

### CTA wiring
All "Book a 10-min look" buttons + footer link open a pre-filled email **to asatianant2678@gmail.com** (subject "A look at Doot" + a ready-to-send body that asks for their company / what they sell / how they do outbound).
Caveat: `mailto:` needs a default mail client — a few webmail-only users get nothing. For reliable capture, swap for an inline form or a Calendly link (see TODOs).

---

## 7. Analytics (built in; needs IDs to turn on)
Paste IDs in the commented block at the top of `doot.html`:
- **Microsoft Clarity** (free) — records *every* click + scroll, heatmaps, session replays. Best answer to "I want data on every click."
- **GA4** — named events / funnels.
- **PostHog** (optional) — product analytics.
- Until an ID is pasted, every event logs to the browser **console** (DevTools → Console) so you can verify it fires.

Events already firing: `page_view` (+ UTM + referrer), `cta_click` (tagged nav/hero/final), `nav_click`, `scroll_depth` (25/50/75/100), `section_view`, `faq_open`, `demo_view`, `demo_step`, `time_on_page`, and **`slot_booked`** (fires automatically when someone books in an embedded **Calendly**).

---

## 8. Open TODOs (prioritized)
1. **Get a sending setup**: dedicated domain + warmed inbox before sending a single cold email.
2. **Replace the founder photo**: swap the `.face` div in `doot.html` for `<img class="face" src="anant.jpg" alt="Anant, founder of Doot">`.
3. **Turn on analytics**: paste Microsoft Clarity + GA4 IDs.
4. **Decide CTA capture**: keep `mailto`, or have Claude build an inline name+email form / wire a Calendly link so `slot_booked` fires reliably.
5. **Build the list + drafts**: export the Apollo CSV → Claude drafts 25–30 personalized emails + a verification tracker.
6. **Optional**: add an "architecture of Doot" diagram (data sources → discovery → drafting → send/inbox → CRM) as a second toggle for technical buyers/investors.
7. **Later**: add real client logos / quantified testimonials once they exist.

## 9. Deferred decisions
- Final pricing model (decide after hearing a few buyers react).
- US expansion timing (after Indian reference logos).
- Building the actual agent product (explicitly deferred — this phase is about selling).

---

*Continue in a new chat by pasting this file in, or asking Claude to "pick up the Doot project from the handoff."*
