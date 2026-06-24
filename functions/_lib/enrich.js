export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(String(ip) + "|" + String(salt));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function geoFromRequest(request) {
  const cf = (request && request.cf) || {};
  return {
    country: cf.country || null,
    city: cf.city || null,
    asn_org: cf.asOrganization || null,
  };
}
