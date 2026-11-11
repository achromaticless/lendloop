/**
 * Admins are bootstrapped from the ADMIN_EMAILS env var on the Convex
 * deployment (comma separated). The role is derived on the server from a
 * verified email; the client can never choose it.
 */
export function isAdminEmail(
  email: string,
  adminEmails: string | undefined,
): boolean {
  if (!adminEmails) return false;
  const wanted = email.trim().toLowerCase();
  return adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}

/** "ana.reyes@example.com" -> "Ana Reyes". Used as the public display name. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._\-+]+/).filter(Boolean);
  if (words.length === 0) return "Neighbor";
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
