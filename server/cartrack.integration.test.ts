import { describe, expect, it } from "vitest";

const baseUrl = process.env.CARTRACK_API_BASE_URL;
const username = process.env.CARTRACK_USERNAME;
const password = process.env.CARTRACK_API_PASSWORD;

const hasCredentials = Boolean(baseUrl && username && password);

describe.runIf(hasCredentials)("Cartrack Tanzania Fleet API", () => {
  it("authenticates and returns the K-Way vehicle collection", async () => {
    const authorization = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await fetch(`${baseUrl}/vehicles?limit=100`, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
      },
      signal: AbortSignal.timeout(20_000),
    });

    const body = await response.json().catch(() => null);
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toBeTypeOf("object");
    expect(Array.isArray(body?.data)).toBe(true);
  }, 25_000);
});
