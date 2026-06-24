import { leadById, updateLead } from "../../../_lib/db.js";

export async function onRequestGet({ env, params }) {
  return Response.json(await leadById(env.DB, Number(params.id)));
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  await updateLead(env.DB, Number(params.id), { status: body.status, company: body.company });
  return Response.json({ ok: true });
}
