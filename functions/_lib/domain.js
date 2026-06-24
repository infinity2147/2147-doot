const FREE = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "aol.com", "proton.me", "protonmail.com", "live.com", "msn.com",
]);

export function companyFromEmail(email) {
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { domain: null, company: null };
  const domain = email.split("@")[1].toLowerCase();
  if (FREE.has(domain)) return { domain, company: "personal" };
  const root = domain.split(".")[0];
  return { domain, company: root.charAt(0).toUpperCase() + root.slice(1) };
}
