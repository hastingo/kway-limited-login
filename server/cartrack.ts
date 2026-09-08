import { z } from "zod";
import { listTripTrackingTargets, updateTripTrackingDistance } from "./portalDb";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_CARTRACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();

const vehicleStatusSchema = z.object({
  vehicle_id: z.union([z.number(), z.string()]).optional(),
  registration: z.string(),
  event_ts: nullableString,
  speed: nullableNumber,
  ignition: z.boolean().nullable().optional(),
  idling: z.boolean().nullable().optional(),
  odometer: nullableNumber,
  driver: z.object({
    first_name: nullableString,
    last_name: nullableString,
    phone_number: nullableString,
  }).nullable().optional(),
  fuel: z.object({
    updated: nullableString,
    level: nullableNumber,
    percentage_left: nullableNumber,
    total_consumed: nullableNumber,
  }).nullable().optional(),
  location: z.object({
    updated: nullableString,
    longitude: nullableNumber,
    latitude: nullableNumber,
    position_description: nullableString,
    gps_fix_type: nullableNumber,
  }).nullable().optional(),
}).passthrough();

const fleetStatusSchema = z.object({
  data: z.array(vehicleStatusSchema).default([]),
}).passthrough();

const odometerSchema = z.object({
  data: z.object({
    registration: z.string().optional(),
    latest_event_ts: nullableString,
    start_timestamp: nullableString,
    end_timestamp: nullableString,
    start_odometer_value: nullableNumber,
    end_odometer_value: nullableNumber,
    distance: nullableNumber,
    current_odometer_value: nullableNumber,
  }).nullable(),
}).passthrough();

export type CartrackFleetVehicle = {
  vehicleId: string;
  registration: string;
  eventTimestamp: string | null;
  speedKph: number | null;
  ignition: boolean | null;
  idling: boolean | null;
  odometerKm: number | null;
  driverName: string | null;
  driverPhone: string | null;
  fuelLevelLiters: number | null;
  fuelPercentage: number | null;
  fuelConsumedLiters: number | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
  locationDescription: string | null;
  gpsFixType: number | null;
};

export class CartrackApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CartrackApiError";
  }
}

function requireCartrackConfig() {
  const baseUrl = process.env.CARTRACK_API_BASE_URL?.replace(/\/+$/, "");
  const username = process.env.CARTRACK_USERNAME;
  const password = process.env.CARTRACK_API_PASSWORD;
  if (!baseUrl || !username || !password) {
    throw new CartrackApiError("Cartrack API connection is not configured");
  }
  return { baseUrl, username, password };
}

async function cartrackGet(path: string, query?: URLSearchParams) {
  const { baseUrl, username, password } = requireCartrackConfig();
  const authorization = Buffer.from(`${username}:${password}`).toString("base64");
  const url = `${baseUrl}${path}${query ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${authorization}`,
    },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && "message" in body
      ? String((body as { message?: unknown }).message)
      : "The Fleet API request failed";
    throw new CartrackApiError(detail, response.status);
  }
  return body;
}

export function normalizeRegistration(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatCartrackTimestamp(timestamp: number) {
  return new Date(timestamp + EAT_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

export function startOfRecordedDay(timestamp: number) {
  const local = new Date(timestamp + EAT_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - EAT_OFFSET_MS;
}

export function endOfRecordedDay(timestamp: number) {
  const local = new Date(timestamp + EAT_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - EAT_OFFSET_MS - 1;
}

export function splitTrackingWindow(startTimestamp: number, endTimestamp: number) {
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) {
    return [] as Array<{ startTimestamp: number; endTimestamp: number }>;
  }
  const windows: Array<{ startTimestamp: number; endTimestamp: number }> = [];
  let cursor = startTimestamp;
  while (cursor < endTimestamp) {
    const windowEnd = Math.min(cursor + MAX_CARTRACK_WINDOW_MS, endTimestamp);
    windows.push({ startTimestamp: cursor, endTimestamp: windowEnd });
    cursor = windowEnd + 1;
  }
  return windows;
}

export async function getCartrackFleetStatus(): Promise<CartrackFleetVehicle[]> {
  const query = new URLSearchParams({ odometer_in_km: "true" });
  const parsed = fleetStatusSchema.parse(await cartrackGet("/vehicles/status", query));
  return parsed.data.map(vehicle => {
    const driverName = [vehicle.driver?.first_name, vehicle.driver?.last_name]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ") || null;
    return {
      vehicleId: String(vehicle.vehicle_id ?? ""),
      registration: vehicle.registration.trim().toUpperCase(),
      eventTimestamp: vehicle.event_ts ?? null,
      speedKph: vehicle.speed ?? null,
      ignition: vehicle.ignition ?? null,
      idling: vehicle.idling ?? null,
      odometerKm: vehicle.odometer ?? null,
      driverName,
      driverPhone: vehicle.driver?.phone_number ?? null,
      fuelLevelLiters: vehicle.fuel?.level ?? null,
      fuelPercentage: vehicle.fuel?.percentage_left ?? null,
      fuelConsumedLiters: vehicle.fuel?.total_consumed ?? null,
      latitude: vehicle.location?.latitude ?? null,
      longitude: vehicle.location?.longitude ?? null,
      locationUpdatedAt: vehicle.location?.updated ?? null,
      locationDescription: vehicle.location?.position_description ?? null,
      gpsFixType: vehicle.location?.gps_fix_type ?? null,
    };
  });
}

async function getDistanceForWindow(registration: string, startTimestamp: number, endTimestamp: number) {
  const query = new URLSearchParams({
    start_timestamp: formatCartrackTimestamp(startTimestamp),
    end_timestamp: formatCartrackTimestamp(endTimestamp),
  });
  const parsed = odometerSchema.parse(
    await cartrackGet(`/vehicles/${encodeURIComponent(registration)}/odometer`, query),
  );
  return {
    distanceMeters: Math.max(0, Number(parsed.data?.distance ?? 0)),
    latestEventTimestamp: parsed.data?.latest_event_ts ?? null,
  };
}

export async function getCartrackDistanceKm(registration: string, startTimestamp: number, endTimestamp: number) {
  const minimumStart = Date.now() - FIVE_YEARS_MS;
  const boundedStart = Math.max(startTimestamp, minimumStart);
  const boundedEnd = Math.min(endTimestamp, Date.now());
  const windows = splitTrackingWindow(boundedStart, boundedEnd);
  let distanceMeters = 0;
  let latestEventTimestamp: string | null = null;
  for (const window of windows) {
    const result = await getDistanceForWindow(registration, window.startTimestamp, window.endTimestamp);
    distanceMeters += result.distanceMeters;
    latestEventTimestamp = result.latestEventTimestamp ?? latestEventTimestamp;
  }
  return {
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    latestEventTimestamp,
    windowsQueried: windows.length,
  };
}

export async function syncCartrackTripDistances() {
  const [vehicles, targets] = await Promise.all([
    getCartrackFleetStatus(),
    listTripTrackingTargets(),
  ]);
  const vehicleByRegistration = new Map(
    vehicles.map(vehicle => [normalizeRegistration(vehicle.registration), vehicle]),
  );
  const syncedAt = Date.now();
  const distanceCache = new Map<string, ReturnType<typeof getCartrackDistanceKm>>();
  const results: Array<{
    tripReference: string;
    registration: string;
    status: "synced" | "unmatched" | "failed" | "outside-retention";
    distanceKm: number | null;
    windowsQueried: number;
    message?: string;
  }> = [];

  const syncTarget = async (target: (typeof targets)[number]) => {
    const registration = target.registrationNumber.trim().toUpperCase();
    const vehicle = vehicleByRegistration.get(normalizeRegistration(registration));
    if (!vehicle) {
      results.push({
        tripReference: target.tripReference,
        registration,
        status: "unmatched",
        distanceKm: null,
        windowsQueried: 0,
        message: "Truck registration was not found in the connected Cartrack fleet",
      });
      return;
    }

    const startTimestamp = startOfRecordedDay(target.dateOfLoading);
    const rawEnd = target.status === "ended" && target.returnedAt
      ? endOfRecordedDay(target.returnedAt)
      : syncedAt;
    if (rawEnd < Date.now() - FIVE_YEARS_MS) {
      results.push({
        tripReference: target.tripReference,
        registration,
        status: "outside-retention",
        distanceKm: null,
        windowsQueried: 0,
        message: "Trip is older than Cartrack's five-year history window",
      });
      return;
    }

    try {
      const cacheKey = `${normalizeRegistration(registration)}:${startTimestamp}:${rawEnd}`;
      let distancePromise = distanceCache.get(cacheKey);
      if (!distancePromise) {
        distancePromise = getCartrackDistanceKm(registration, startTimestamp, rawEnd);
        distanceCache.set(cacheKey, distancePromise);
      }
      const distance = await distancePromise;
      await updateTripTrackingDistance(target.tripReference, distance.distanceKm, syncedAt);
      results.push({
        tripReference: target.tripReference,
        registration,
        status: "synced",
        distanceKm: distance.distanceKm,
        windowsQueried: distance.windowsQueried,
      });
    } catch (error) {
      results.push({
        tripReference: target.tripReference,
        registration,
        status: "failed",
        distanceKm: null,
        windowsQueried: 0,
        message: error instanceof Error ? error.message : "Distance synchronization failed",
      });
    }
  };

  for (let index = 0; index < targets.length; index += 4) {
    await Promise.all(targets.slice(index, index + 4).map(syncTarget));
  }

  return {
    provider: "Cartrack Tanzania" as const,
    portalUrl: "https://fleetweb-tz.cartrack.com/map/fleet",
    syncedAt,
    vehicles,
    results,
    summary: {
      vehicles: vehicles.length,
      trips: targets.length,
      synced: results.filter(result => result.status === "synced").length,
      unmatched: results.filter(result => result.status === "unmatched").length,
      failed: results.filter(result => result.status === "failed").length,
      outsideRetention: results.filter(result => result.status === "outside-retention").length,
    },
  };
}
