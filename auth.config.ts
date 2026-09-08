import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Auto-correct AUTH_URL if running on Vercel with a localhost env var
if (process.env.VERCEL && process.env.AUTH_URL?.includes("localhost")) {
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "vibecode-editor-iota.vercel.app";
  process.env.AUTH_URL = `https://${vercelHost}`;
  process.env.NEXTAUTH_URL = `https://${vercelHost}`;
}

export default {
  trustHost: true,
  providers: [
    Github({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
} satisfies NextAuthConfig;