import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  publicRoutes,
  authRoutes,
} from "@/routes";
import authConfig from "./auth.config";

// Auto-correct AUTH_URL if running on Vercel with a localhost env var
if (process.env.VERCEL && process.env.AUTH_URL?.includes("localhost")) {
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "vibecode-editor-iota.vercel.app";
  process.env.AUTH_URL = `https://${vercelHost}`;
  process.env.NEXTAUTH_URL = `https://${vercelHost}`;
}

const { auth } = NextAuth(authConfig);

// @ts-ignore
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Determine actual public host and protocol from request headers to prevent redirecting to localhost:3000
  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = req.headers.get("host");
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

  let host = forwardedHost || hostHeader || nextUrl.host;
  if (isProd && (!host || host.includes("localhost"))) {
    host =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      "vibecode-editor-iota.vercel.app";
  }

  let proto = req.headers.get("x-forwarded-proto");
  if (!proto) {
    proto = isProd ? "https" : (host.includes("localhost") ? "http" : "https");
  }
  const baseUrl = `${proto}://${host}`;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);

  if (isApiAuthRoute) {
    return null;
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, baseUrl));
    }
    return null;
  }

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/auth/sign-in", baseUrl));
  }

  return null;
});

export const config = {
  // Match all request paths except static files, favicon, and _next
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};