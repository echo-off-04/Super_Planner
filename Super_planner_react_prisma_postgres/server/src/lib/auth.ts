import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export const SESSION_COOKIE = "super_planner_session";

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionTokenPayload extends SessionUser {
  sub: string;
}

export type AuthenticatedRequest = Request & {
  user: SessionUser;
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken(user: SessionUser): string {
  return jwt.sign({ sub: user.id, id: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionTokenPayload;
    return {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export function readSessionUser(req: Request): SessionUser | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== "string") return null;
  return verifySessionToken(token);
}

export function setSessionCookie(res: Response, user: SessionUser): void {
  res.cookie(SESSION_COOKIE, createSessionToken(user), cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = readSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).user = user;
  next();
}