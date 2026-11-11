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
