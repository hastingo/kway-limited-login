import { describe, expect, it } from "vitest";
import { createPortalSession, readPortalSession, validateTemporaryCredentials } from "./portalAuth";
import type { Request } from "express";

describe("temporary K-Way portal authentication", () => {
  it("accepts only the configured temporary credentials", () => {
    expect(validateTemporaryCredentials("sales@k-way.co.tz", "sales@2024")).toBe(true);
    expect(validateTemporaryCredentials("SALES@K-WAY.CO.TZ", "sales@2024")).toBe(true);
    expect(validateTemporaryCredentials("sales@k-way.co.tz", "wrong-password")).toBe(false);
  });

  it("creates a signed session that can be read from the request cookie", () => {
    const { token, expiresAt } = createPortalSession("sales@k-way.co.tz", false);
    const req = { headers: { cookie: `kway_portal_session=${encodeURIComponent(token)}` } } as Request;
    expect(readPortalSession(req)).toEqual({
      email: "sales@k-way.co.tz",
      name: "Sales Operations",
      expiresAt,
    });
  });
});
