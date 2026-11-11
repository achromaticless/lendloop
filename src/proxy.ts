import { clerkMiddleware } from "@clerk/nextjs/server";

// The proxy only makes the Clerk session available. Access control is done per
// resource: the (app) layout calls auth.protect(), and every Convex function
// checks the caller itself. Path matching here would be a second, weaker gate.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
