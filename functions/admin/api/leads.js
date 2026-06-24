import { listLeads } from "../../_lib/db.js";

export async function onRequestGet({ env }) {
  return Response.json({ leads: await listLeads(env.DB) });
}
