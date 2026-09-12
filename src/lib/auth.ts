import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "hostel_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_USER_CACHE_MS = 30_000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const sessionUserCache = new Map<string, { user: SessionUser; expiresAt: number }>();

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not configured. Set it in your environment variables (min 32 chars).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

const verifySessionToken = cache(async (token: string): Promise<SessionUser | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = payload as unknown as SessionUser;
    if (!user?.id || !user?.role) return null;
    const cached = sessionUserCache.get(token);
    if (cached && cached.expiresAt > Date.now()) return cached.user;
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!currentUser) return null;
    sessionUserCache.set(token, { user: currentUser, expiresAt: Date.now() + SESSION_USER_CACHE_MS });
    return currentUser;
  } catch {
    return null;
  }
});

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Returns the session or redirects to /login (for server components/actions). */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Returns the session if it has any of the given roles, else redirects to /dashboard. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const session = await requireUser();
  if (!roles.includes(session.role)) redirect("/dashboard");
  return session;
}

/**
 * For server actions: return the session only if the user holds the given
 * permission, otherwise null. Callers return a friendly error when null.
 */
export async function getAuthorized(permission: Permission): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  return can(session.role, permission) ? session : null;
}
