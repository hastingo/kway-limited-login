import { createHash, createHmac, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { publicProcedure } from "./_core/trpc";

const PORTAL_COOKIE = "kway_portal_session";
const TEMP_EMAIL = "sales@k-way.co.tz";
const TEMP_PASSWORD_HASH = "ab5205fbd3e8ecc9c00161748a2575b8168a18a7aad5bf6a38f5a9dd205dbcd6";
const DEVELOPMENT_SECRET = "kway-development-session-secret-change-before-production";

export type PortalUser = {
  email: string;
  name: string;
  expiresAt: number;
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSecret() {
  return ENV.cookieSecret || DEVELOPMENT_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function parseCookies(req: Request) {
  const cookieHeader = req.headers.cookie ?? "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

export function validateTemporaryCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === TEMP_EMAIL && safeEqual(hash(password), TEMP_PASSWORD_HASH);
}

export function createPortalSession(email: string, rememberMe: boolean) {
  const expiresAt = Date.now() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000);
  const payload = `${email.toLowerCase()}|${expiresAt}`;
  return { token: `${payload}|${sign(payload)}`, expiresAt };
}

export function readPortalSession(req: Request): PortalUser | null {
  const token = parseCookies(req)[PORTAL_COOKIE];
  if (!token) return null;

  const [email, expiresRaw, signature] = token.split("|");
  if (!email || !expiresRaw || !signature) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const payload = `${email}|${expiresAt}`;
  if (!safeEqual(sign(payload), signature)) return null;

  return { email, name: "Sales Operations", expiresAt };
}

export function setPortalSessionCookie(req: Request, res: Response, token: string, expiresAt: number) {
  res.cookie(PORTAL_COOKIE, token, {
    ...getSessionCookieOptions(req),
    expires: new Date(expiresAt),
  });
}

export function clearPortalSessionCookie(req: Request, res: Response) {
  res.clearCookie(PORTAL_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
}

export const portalProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const portalUser = readPortalSession(ctx.req);
  if (!portalUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "K-Way portal login required" });
  }

  return next({
    ctx: {
      ...ctx,
      portalUser,
    },
  });
});

export const portalLoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().default(false),
});

export const PORTAL_LOGIN_EMAIL = TEMP_EMAIL;
