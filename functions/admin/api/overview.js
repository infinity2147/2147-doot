import { overview, rangeToSince } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const range = new URL(request.url).searchParams.get("range") || "7d";
  const data = await overview(env.DB, rangeToSince(range));
  return Response.json(data);
}
