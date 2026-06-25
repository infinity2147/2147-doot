import { updateOutreach } from "../../../_lib/db.js";

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  await updateOutreach(env.DB, Number(params.id), body);
  return Response.json({ ok: true });
}
