import { MapPinned, Navigation, RefreshCw, Route, Truck, Waves } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, MetricCard, PageHeader, Panel, StatusPill, primaryButton } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, TruckRecord } from "./utils";
import { shortDate } from "./utils";

export default function TrackingTab({ incomes, expenses, trucks }: { incomes: IncomeRecord[]; expenses: ExpenseRecord[]; trucks: TruckRecord[] }) {
  const trips = Array.from(new Set(incomes.map(item => item.tripReference))).map(reference => {
    const records = incomes.filter(item => item.tripReference === reference);
    const main = records.find(item => item.cargoType === "going") ?? records[0];
    const distance = records.find(item => item.trackedDistanceKm)?.trackedDistanceKm;
    const syncedAt = records.find(item => item.trackingSyncedAt)?.trackingSyncedAt;
    const fuelLiters = expenses
      .filter(item => item.tripReference === reference)
      .reduce((sum, item) => sum + Number(item.fuelLiters ?? 0), 0);
    return { reference, main, distance: Number(distance ?? 0), syncedAt, fuelLiters };
  });
  const trackedTrips = trips.filter(item => item.distance > 0);
  const totalDistance = trackedTrips.reduce((sum, item) => sum + item.distance, 0);
  const totalFuel = trips.reduce((sum, item) => sum + item.fuelLiters, 0);

  const requestConnection = () => {
    toast.info("Tracking portal URL required", {
      description: "Add the GPS provider login URL so K-Way can connect securely and retrieve vehicle distance data.",
      duration: 6500,
    });
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Fleet intelligence"
        title="Truck tracking"
        description="Match GPS movement to each trip and truck, then compare distance travelled with recorded fuel liters."
        action={<button type="button" onClick={requestConnection} className={primaryButton}><RefreshCw className="size-4" />Connect & sync</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Truck} label="Tracked fleet" value={String(trucks.length)} detail="Registered portal trucks" tone="navy" />
        <MetricCard icon={Navigation} label="Trips with GPS" value={String(trackedTrips.length)} detail={`${trips.length} total trip references`} tone="green" />
        <MetricCard icon={Route} label="Distance captured" value={`${totalDistance.toLocaleString()} km`} detail="Start-to-end trip distance" tone="orange" />
        <MetricCard icon={Waves} label="Fuel captured" value={`${totalFuel.toLocaleString()} L`} detail="Ready for mileage analysis" tone="red" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[#edf0ee] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Trip tracking allocation</h2><p className="mt-1 text-[10px] text-[#8a949b]">Each trip inherits its truck, fuel volume, and GPS distance</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-extrabold text-amber-700">GPS provider URL needed</span>
        </div>
        {trips.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Trip</th><th className="px-5 py-3">Truck details</th><th className="px-5 py-3">Loaded / returned</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">GPS distance</th><th className="px-5 py-3">Fuel volume</th><th className="px-5 py-3">Fuel rate</th><th className="px-5 py-3">Last sync</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{trips.map(item => <tr key={item.reference} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#18354f]">{item.reference}</td><td className="px-5 py-4"><p className="font-extrabold text-[#30475a]">{item.main.truck.registrationNumber} · {item.main.truck.model}</p><p className="mt-1 text-[#89939a]">{item.main.truck.driverName} · {item.main.truck.driverPhone}</p></td><td className="px-5 py-4"><p>{shortDate(item.main.dateOfLoading)}</p><p className="mt-1 text-[#89939a]">{shortDate(item.main.returnedAt)}</p></td><td className="px-5 py-4"><StatusPill status={item.main.status} /></td><td className="px-5 py-4 font-extrabold text-[#30475a]">{item.distance ? `${item.distance.toLocaleString()} km` : "Pending sync"}</td><td className="px-5 py-4 font-extrabold text-sky-700">{item.fuelLiters ? `${item.fuelLiters.toLocaleString()} L` : "—"}</td><td className="px-5 py-4">{item.distance && item.fuelLiters ? `${((item.fuelLiters / item.distance) * 100).toFixed(2)} L/100km` : "—"}</td><td className="px-5 py-4">{item.syncedAt ? new Date(item.syncedAt).toLocaleString() : "Not connected"}</td></tr>)}</tbody></table></div> : <EmptyState icon={MapPinned} title="No trips to track" description="Create an income trip to allocate GPS distance and fuel usage." />}
      </Panel>
    </div>
  );
}
