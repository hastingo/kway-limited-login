import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  endOfRecordedDay,
  formatCartrackTimestamp,
  getCartrackDistanceKm,
  getCartrackFleetStatus,
  normalizeRegistration,
  splitTrackingWindow,
  startOfRecordedDay,
} from "./cartrack";

const originalFetch = global.fetch;

describe("Cartrack helpers", () => {
  beforeEach(() => {
    process.env.CARTRACK_API_BASE_URL = "https://fleetapi-tz.cartrack.com/rest";
    process.env.CARTRACK_USERNAME = "test-user";
    process.env.CARTRACK_API_PASSWORD = "test-password";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("normalizes portal and Cartrack registrations for matching", () => {
    expect(normalizeRegistration("T 197-EMW")).toBe("T197EMW");
  });

  it("formats timestamps in East Africa Time for Cartrack", () => {
    expect(formatCartrackTimestamp(Date.UTC(2026, 8, 1, 21, 0, 0))).toBe("2026-09-02 00:00:00");
  });

  it("expands a date-only record to the complete East Africa business day", () => {
    const noonInDar = Date.UTC(2026, 8, 7, 9, 0, 0);
    expect(formatCartrackTimestamp(startOfRecordedDay(noonInDar))).toBe("2026-09-07 00:00:00");
    expect(formatCartrackTimestamp(endOfRecordedDay(noonInDar))).toBe("2026-09-07 23:59:59");
  });

  it("splits long trip windows below Cartrack's 31-day maximum", () => {
    const start = Date.UTC(2026, 0, 1);
    const end = start + 65 * 24 * 60 * 60 * 1000;
    const windows = splitTrackingWindow(start, end);
    expect(windows).toHaveLength(3);
    expect(windows.every(window => window.endTimestamp - window.startTimestamp <= 30 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(windows[0].startTimestamp).toBe(start);
    expect(windows.at(-1)?.endTimestamp).toBe(end);
  });

  it("maps the live vehicle status response to portal-safe fields", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        vehicle_id: 454711769,
        registration: "T197EMW",
        event_ts: "2026-09-08 08:00:00+03",
        speed: 42,
        ignition: true,
        idling: false,
        odometer: 50123.4,
        driver: { first_name: "Asha", last_name: "Juma", phone_number: "+255700000000" },
        fuel: { level: 128.5, percentage_left: 64, total_consumed: 2500 },
        location: { latitude: -6.82, longitude: 39.28, position_description: "Dar es Salaam", gps_fix_type: 3 },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const vehicles = await getCartrackFleetStatus();
    expect(vehicles).toEqual([expect.objectContaining({
      vehicleId: "454711769",
      registration: "T197EMW",
      speedKph: 42,
      driverName: "Asha Juma",
      fuelLevelLiters: 128.5,
      locationDescription: "Dar es Salaam",
    })]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://fleetapi-tz.cartrack.com/rest/vehicles/status?odometer_in_km=true",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }) }),
    );
  });

  it("converts Cartrack odometer distance from meters to kilometers", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { registration: "T197EMW", distance: 123450, latest_event_ts: "2026-09-08 08:00:00+03" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const end = Date.now() - 1_000;
    const result = await getCartrackDistanceKm("T197EMW", end - 60_000, end);
    expect(result.distanceKm).toBe(123.45);
    expect(result.windowsQueried).toBe(1);
  });
});
