import { AlertTriangle, ArrowUpRight, CircleDollarSign, Route, TrendingUp, Truck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ExpenseRecord, IncomeRecord, TruckRecord } from "./utils";
import { money, shortDate } from "./utils";
import { EmptyState, MetricCard, PageHeader, Panel, StatusPill } from "./PortalUI";

export default function OverviewTab({ trucks, incomes, expenses }: { trucks: TruckRecord[]; incomes: IncomeRecord[]; expenses: ExpenseRecord[] }) {
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.incomeAmount), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const tripReferences = new Set(incomes.map(item => item.tripReference));
  const activeReferences = new Set(incomes.filter(item => item.status === "active").map(item => item.tripReference));
  const now = Date.now();
  const alerts = trucks.flatMap(truck => truck.documents.map(document => ({ truck, document }))).filter(item => item.document.expiryDate <= now + 14 * 86400000);
  const cargoData = [
    { name: "Going cargo", value: incomes.filter(item => item.cargoType === "going").length, color: "#183a56" },
    { name: "Return cargo", value: incomes.filter(item => item.cargoType === "return").length, color: "#ef812f" },
  ].filter(item => item.value > 0);

  return (
    <div className="page-enter">
      <PageHeader eyebrow="Operations control" title="Good day, team" description="A live view of fleet readiness, trip activity, and financial performance across K-Way operations." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Total income" value={money(totalIncome)} detail={`${incomes.length} income record${incomes.length === 1 ? "" : "s"}`} tone="green" />
        <MetricCard icon={TrendingUp} label="Net position" value={money(totalIncome - totalExpenses)} detail={`${money(totalExpenses)} expenses`} tone={totalIncome - totalExpenses >= 0 ? "navy" : "red"} />
        <MetricCard icon={Route} label="Active trips" value={String(activeReferences.size)} detail={`${tripReferences.size} total trip references`} tone="orange" />
        <MetricCard icon={Truck} label="Fleet" value={String(trucks.length)} detail={`${alerts.length} document alert${alerts.length === 1 ? "" : "s"}`} tone={alerts.length ? "red" : "navy"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4">
            <div><h2 className="text-sm font-extrabold text-[#24384b]">Recent trip activity</h2><p className="mt-1 text-[10px] text-[#8a949b]">Latest cargo records across the fleet</p></div>
            <span className="rounded-full bg-[#f4f5f2] px-3 py-1.5 text-[9px] font-bold text-[#687681]">{incomes.length} records</span>
          </div>
          {incomes.length === 0 ? (
            <EmptyState icon={Route} title="No trips recorded" description="Income records will appear here as soon as the first trip is created." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left">
                <thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Truck</th><th className="px-5 py-3">Destination</th><th className="px-5 py-3">Loaded</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Income</th></tr></thead>
                <tbody className="divide-y divide-[#edf0ee]">
                  {incomes.slice(0, 6).map(item => (
                    <tr key={item.id} className="text-xs text-[#405265] transition-colors hover:bg-[#fafbf9]">
                      <td className="px-5 py-4 font-extrabold text-[#18354f]">{item.tripReference}</td>
                      <td className="px-5 py-4">{item.truck.registrationNumber}</td>
                      <td className="px-5 py-4">{item.destination}</td>
                      <td className="px-5 py-4">{shortDate(item.dateOfLoading)}</td>
                      <td className="px-5 py-4"><StatusPill status={item.status} /></td>
                      <td className="px-5 py-4 text-right font-bold text-[#24384b]">{money(item.incomeAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-[#24384b]">Cargo mix</h2><p className="mt-1 text-[10px] text-[#8a949b]">Going vs return loads</p></div><ArrowUpRight className="size-4 text-[#dc681c]" /></div>
          <div className="mt-4 h-44">
            {cargoData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={cargoData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={5} stroke="none">{cargoData.map(entry => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e3e7e5", fontSize: 11 }} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8f5] text-xs text-[#8b959c]">Chart appears after first trip</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cargoData.map(item => <div key={item.name} className="rounded-xl bg-[#f7f8f5] p-3"><span className="mb-2 block size-2 rounded-full" style={{ backgroundColor: item.color }} /><p className="font-display text-xl font-bold text-[#17354f]">{item.value}</p><p className="text-[9px] font-bold text-[#7f8a92] uppercase">{item.name}</p></div>)}
          </div>
        </Panel>
      </div>

      {alerts.length > 0 ? (
        <Panel className="mt-5 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/70 px-5 py-4"><AlertTriangle className="size-4 text-amber-600" /><div><h2 className="text-xs font-extrabold text-amber-900">Document expiry attention</h2><p className="mt-0.5 text-[10px] text-amber-700">Expired or expiring within the next 14 days</p></div></div>
          <div className="divide-y divide-[#edf0ee]">{alerts.slice(0, 5).map(({ truck, document }) => <div key={document.id} className="flex items-center justify-between gap-4 px-5 py-3 text-xs"><div><span className="font-extrabold text-[#24384b]">{truck.registrationNumber}</span><span className="mx-2 text-[#bdc4c4]">·</span><span className="text-[#66737f]">{document.documentType}</span></div><span className="font-bold text-amber-700">Expires {shortDate(document.expiryDate)}</span></div>)}</div>
        </Panel>
      ) : null}
    </div>
  );
}
