import { trpc } from "@/lib/trpc";
import {
  ExternalLink,
  Fuel,
  Gauge,
  MapPin,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Satellite,
  Truck,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, MetricCard, PageHeader, Panel, StatusPill, primaryButton } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, TruckRecord } from "./utils";
import { shortDate } from "./utils";

const CARTRACK_PORTAL_URL = "https://fleetweb-tz.cartrack.com/map/fleet";

function normalizeRegistration(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function dateTime(value: string | number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" });
}

export default function TrackingTab({ incomes, expenses, trucks }: { incomes: IncomeRecord[]; expenses: ExpenseRecord[]; trucks: TruckRecord[] }) {
  const utils = trpc.useUtils();
  const liveQuery = trpc.portal.tracking.status.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
  });
  const syncTracking = trpc.portal.tracking.sync.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.portal.income.list.invalidate(),
        utils.portal.tracking.status.invalidate(),
      ]);
      if (result.summary.failed || result.summary.unmatched || result.summary.outsideRetention) {
        toast.warning("Cartrack sync completed with exceptions", {
          description: `${result.summary.synced} synced · ${result.summary.unmatched} unmatched · ${result.summary.failed} failed`,
        });
      } else {
        toast.success("Cartrack sync completed", {
          description: `${result.summary.synced} trip${result.summary.synced === 1 ? "" : "s"} updated from live odometer data.`,
        });
      }
    },
    onError: error => toast.error("Cartrack sync failed", { description: error.message }),
  });

  const liveVehicles = liveQuery.data?.vehicles ?? [];
  const vehicleByRegistration = new Map(
    liveVehicles.map(vehicle => [normalizeRegistration(vehicle.registration), vehicle]),
  );
  const trips = Array.from(new Set(incomes.map(item => item.tripReference))).map(reference => {
    const records = incomes.filter(item => item.tripReference === reference);
    const main = records.find(item => item.cargoType === "going") ?? records[0];
    const distance = records.find(item => item.trackedDistanceKm)?.trackedDistanceKm;
    const syncedAt = records.find(item => item.trackingSyncedAt)?.trackingSyncedAt;
    const fuelLiters = expenses
      .filter(item => item.tripReference === reference)
      .reduce((sum, item) => sum + Number(item.fuelLiters ?? 0), 0);
    const liveVehicle = vehicleByRegistration.get(normalizeRegistration(main.truck.registrationNumber));
    return { reference, main, distance: Number(distance ?? 0), syncedAt, fuelLiters, liveVehicle };
  });
  const trackedTrips = trips.filter(item => Boolean(item.syncedAt));
  const totalDistance = trackedTrips.reduce((sum, item) => sum + item.distance, 0);
  const totalFuel = trips.reduce((sum, item) => sum + item.fuelLiters, 0);
  const movingVehicles = liveVehicles.filter(vehicle => vehicle.ignition && !vehicle.idling).length;

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Fleet intelligence"
        title="Truck tracking"
        description="Live Cartrack vehicle status, start-to-end trip distance, and fuel performance in one workspace."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={CARTRACK_PORTAL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce2df] bg-white px-4 text-xs font-extrabold text-[#30475a] shadow-sm transition hover:border-[#c5cfca] hover:text-[#c9580e]"
            >
              <ExternalLink className="size-4" />Open Cartrack
            </a>
            <button
              type="button"
              onClick={() => syncTracking.mutate()}
              disabled={syncTracking.isPending}
              className={primaryButton}
            >
              <RefreshCw className={`size-4 ${syncTracking.isPending ? "animate-spin" : ""}`} />
              {syncTracking.isPending ? "Syncing trips…" : "Sync Cartrack"}
            </button>
          </div>
        )}
      />

      {liveQuery.error ? (
        <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>Cartrack live data could not be loaded: {liveQuery.error.message}</span>
          <button type="button" onClick={() => liveQuery.refetch()} className="font-extrabold underline">Try again</button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Satellite} label="Live Cartrack fleet" value={liveQuery.isLoading ? "…" : String(liveVehicles.length)} detail={`${movingVehicles} moving · ${trucks.length} portal trucks`} tone="navy" />
        <MetricCard icon={Navigation} label="Trips with GPS" value={String(trackedTrips.length)} detail={`${trips.length} total trip references`} tone="green" />
        <MetricCard icon={Route} label="Distance captured" value={`${totalDistance.toLocaleString()} km`} detail="From loading to trip end" tone="orange" />
        <MetricCard icon={Waves} label="Fuel captured" value={`${totalFuel.toLocaleString()} L`} detail="Ready for mileage analysis" tone="red" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[#edf0ee] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#24384b]">Live Cartrack fleet</h2>
            <p className="mt-1 text-[10px] text-[#8a949b]">Current ignition, position, odometer, speed, and fuel telemetry</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-[9px] font-extrabold ${liveQuery.isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {liveQuery.isLoading ? "Connecting…" : liveQuery.isSuccess ? `Connected · ${dateTime(liveQuery.data.fetchedAt)}` : "Connection unavailable"}
          </span>
        </div>
        {liveQuery.isLoading ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2"><div className="h-44 animate-pulse rounded-2xl bg-[#f3f5f2]" /><div className="h-44 animate-pulse rounded-2xl bg-[#f3f5f2]" /></div>
        ) : liveVehicles.length ? (
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {liveVehicles.map(vehicle => {
              const moving = Boolean(vehicle.ignition && !vehicle.idling);
              const state = vehicle.ignition ? (vehicle.idling ? "Idling" : "Moving") : "Parked";
              const mapUrl = vehicle.latitude != null && vehicle.longitude != null
                ? `https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`
                : null;
              return (
                <article key={`${vehicle.vehicleId}-${vehicle.registration}`} className="rounded-2xl border border-[#e1e6e3] bg-[#fbfcfa] p-4 shadow-[0_10px_30px_rgba(25,50,70,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#153852] text-white"><Truck className="size-5" /></span>
                      <div><h3 className="text-sm font-extrabold text-[#1e384f]">{vehicle.registration}</h3><p className="mt-0.5 text-[10px] text-[#879199]">{vehicle.driverName || "No driver reported"}</p></div>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold ${moving ? "bg-emerald-100 text-emerald-700" : vehicle.ignition ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{state}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <LiveMetric icon={Gauge} label="Speed" value={`${vehicle.speedKph ?? 0} km/h`} />
                    <LiveMetric icon={Navigation} label="Odometer" value={vehicle.odometerKm == null ? "—" : `${Number(vehicle.odometerKm).toLocaleString()} km`} />
                    <LiveMetric icon={Fuel} label="Fuel level" value={vehicle.fuelLevelLiters == null ? "—" : `${vehicle.fuelLevelLiters.toLocaleString()} L`} />
                    <LiveMetric icon={Satellite} label="GPS fix" value={vehicle.gpsFixType == null ? "—" : `${vehicle.gpsFixType}/3`} />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-white p-3">
                    <div className="flex min-w-0 gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[#c9580e]" /><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#415565]">{vehicle.locationDescription || "Location description unavailable"}</p><p className="mt-1 text-[9px] text-[#8a949b]">Updated {dateTime(vehicle.locationUpdatedAt || vehicle.eventTimestamp)}</p></div></div>
                    {mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[9px] font-extrabold text-[#c9580e] hover:underline">Map</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={MapPinned} title="No Cartrack vehicles returned" description="The API connection is active, but no vehicles are available to this credential." />
        )}
      </Panel>

      {syncTracking.data ? (
        <Panel className="mt-5 overflow-hidden">
          <div className="border-b border-[#edf0ee] px-5 py-4"><h2 className="text-sm font-extrabold text-[#24384b]">Latest synchronization</h2><p className="mt-1 text-[10px] text-[#8a949b]">Completed {dateTime(syncTracking.data.syncedAt)} · {syncTracking.data.summary.synced} synced · {syncTracking.data.summary.unmatched} unmatched · {syncTracking.data.summary.failed} failed</p></div>
          <div className="divide-y divide-[#edf0ee]">
            {syncTracking.data.results.map(result => (
              <div key={result.tripReference} className="flex flex-col gap-2 px-5 py-3 text-[10px] sm:flex-row sm:items-center sm:justify-between">
                <div><span className="font-extrabold text-[#24384b]">{result.tripReference}</span><span className="ml-2 text-[#8a949b]">{result.registration}</span>{result.message ? <p className="mt-1 text-red-600">{result.message}</p> : null}</div>
                <div className="flex items-center gap-2"><SyncStatus status={result.status} /><span className="font-extrabold text-[#30475a]">{result.distanceKm == null ? "—" : `${result.distanceKm.toLocaleString()} km`}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[#edf0ee] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Trip tracking allocation</h2><p className="mt-1 text-[10px] text-[#8a949b]">Each trip inherits its truck, fuel volume, and Cartrack start-to-end distance</p></div>
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold ${liveQuery.isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{liveQuery.isSuccess ? "Cartrack connected" : "Waiting for Cartrack"}</span>
        </div>
        {trips.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Trip</th><th className="px-5 py-3">Truck details</th><th className="px-5 py-3">Cartrack</th><th className="px-5 py-3">Loaded / returned</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">GPS distance</th><th className="px-5 py-3">Fuel volume</th><th className="px-5 py-3">Fuel rate</th><th className="px-5 py-3">Last sync</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{trips.map(item => <tr key={item.reference} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#18354f]">{item.reference}</td><td className="px-5 py-4"><p className="font-extrabold text-[#30475a]">{item.main.truck.registrationNumber} · {item.main.truck.model}</p><p className="mt-1 text-[#89939a]">{item.main.truck.driverName} · {item.main.truck.driverPhone}</p></td><td className="px-5 py-4">{item.liveVehicle ? <span className="font-extrabold text-emerald-700">Matched live</span> : <span className="font-bold text-amber-700">Not found</span>}</td><td className="px-5 py-4"><p>{shortDate(item.main.dateOfLoading)}</p><p className="mt-1 text-[#89939a]">{shortDate(item.main.returnedAt)}</p></td><td className="px-5 py-4"><StatusPill status={item.main.status} /></td><td className="px-5 py-4 font-extrabold text-[#30475a]">{item.syncedAt ? `${item.distance.toLocaleString()} km` : "Pending sync"}</td><td className="px-5 py-4 font-extrabold text-sky-700">{item.fuelLiters ? `${item.fuelLiters.toLocaleString()} L` : "—"}</td><td className="px-5 py-4">{item.distance && item.fuelLiters ? `${((item.fuelLiters / item.distance) * 100).toFixed(2)} L/100km` : "—"}</td><td className="px-5 py-4">{item.syncedAt ? dateTime(item.syncedAt) : "Not synced"}</td></tr>)}</tbody></table></div> : <EmptyState icon={MapPinned} title="No trips to track" description="Create an income trip to allocate Cartrack distance and fuel usage." />}
      </Panel>
    </div>
  );
}

function LiveMetric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><Icon className="size-3.5 text-[#c9580e]" /><p className="mt-2 text-[8px] font-extrabold tracking-[0.08em] text-[#8a949b] uppercase">{label}</p><p className="mt-1 truncate text-[10px] font-extrabold text-[#30475a]">{value}</p></div>;
}

function SyncStatus({ status }: { status: "synced" | "unmatched" | "failed" | "outside-retention" }) {
  const styles = status === "synced"
    ? "bg-emerald-50 text-emerald-700"
    : status === "unmatched" || status === "outside-retention"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return <span className={`rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase ${styles}`}>{status.replace("-", " ")}</span>;
}
