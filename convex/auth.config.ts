import type { AuthConfig } from "convex/server";

// Convex trusts JWTs issued by Clerk. The issuer domain lives in an env var set
// on the Convex deployment (`npx convex env set CLERK_JWT_ISSUER_DOMAIN ...`),
// never hard-coded, so dev and prod can point at different Clerk instances.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
