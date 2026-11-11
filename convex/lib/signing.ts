// Short-lived HS256 tokens used in both directions between Convex and n8n.
//
// Each request carries `Authorization: Bearer <jwt>` where the claims bind the
// token to ONE request: a hash of the exact body bytes (`bh`), plus for calls
// into Convex the HTTP method (`m`) and path with query (`p`). A captured token
// can therefore not be replayed against another endpoint or with another body,
// and it expires within minutes. The secret never travels: each side holds it
// in its own secret store (Convex env vars, n8n credentials).

const encoder = new TextEncoder();
const MAX_LIFETIME_SECONDS = 600;
const CLOCK_SKEW_SECONDS = 60;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signJwt(claims: Record<string, unknown>, secret: string): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), encoder.encode(data));
  return `${data}.${toBase64Url(new Uint8Array(signature))}`;
}

export type VerifyResult =
  | { ok: true; claims: Record<string, unknown> }
  | { ok: false; reason: string };

/** Verifies signature (constant time), algorithm, and the time window. */
export async function verifyJwt(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };
  const [header, payload, signature] = parts;

  const headerJson = fromBase64Url(header);
  const sig = fromBase64Url(signature);
  const payloadJson = fromBase64Url(payload);
  if (!headerJson || !sig || !payloadJson) return { ok: false, reason: "malformed token" };

  let parsedHeader: { alg?: string };
  let claims: Record<string, unknown>;
  try {
    parsedHeader = JSON.parse(new TextDecoder().decode(headerJson));
    claims = JSON.parse(new TextDecoder().decode(payloadJson));
  } catch {
    return { ok: false, reason: "malformed token" };
  }
  // Pin the algorithm: never trust the token to choose how it is verified.
  if (parsedHeader.alg !== "HS256") return { ok: false, reason: "unsupported algorithm" };

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, ["verify"]),
    sig,
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return { ok: false, reason: "bad signature" };

  const { iat, exp } = claims;
  if (typeof iat !== "number" || typeof exp !== "number") return { ok: false, reason: "missing times" };
  if (exp < nowSeconds) return { ok: false, reason: "token expired" };
  if (iat > nowSeconds + CLOCK_SKEW_SECONDS) return { ok: false, reason: "token from the future" };
  if (exp - iat > MAX_LIFETIME_SECONDS) return { ok: false, reason: "token lives too long" };

  return { ok: true, claims };
}
