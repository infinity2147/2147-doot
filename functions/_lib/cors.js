export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env && env.SITE_ORIGIN) || "";
  const allow = origin && (origin === allowed) ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
