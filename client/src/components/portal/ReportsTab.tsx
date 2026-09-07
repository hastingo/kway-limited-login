import { BarChart3, Download, FileSpreadsheet, Scale, TrendingDown, TrendingUp, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, MetricCard, PageHeader, Panel, secondaryButton } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, TruckRecord } from "./utils";
import { exportExcel, exportPdf, money } from "./utils";

type ReportTab = "global" | "trip" | "truck" | "service";
type ReportRow = { name: string; income: number; expenses: number; profit: number };

export default function ReportsTab({ incomes, expenses, trucks }: { incomes: IncomeRecord[]; expenses: ExpenseRecord[]; trucks: TruckRecord[] }) {
  const [view, setView] = useState<ReportTab>("global");
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.incomeAmount), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const tripTruck = new Map(incomes.map(item => [item.tripReference, item.truck.registrationNumber]));
  const truckById = new Map(trucks.map(truck => [truck.id, truck.registrationNumber]));

  const rows = useMemo<ReportRow[]>(() => {
    if (view === "global") return [{ name: "K-Way Limited", income: totalIncome, expenses: totalExpenses, profit: totalIncome - totalExpenses }];
    if (view === "service") {
      return trucks.map(truck => {
        const refs = new Set(incomes.filter(item => item.truckId === truck.id).map(item => item.tripReference));
        const serviceExpenses = expenses.filter(item =>
          (item.truckId === truck.id || refs.has(item.tripReference)) &&
          (item.tripReference === "MAINTENANCE" || /maintenance|service|repair|tyre/i.test(item.expenseType))
        ).reduce((sum, item) => sum + Number(item.amount), 0);
        return { name: truck.registrationNumber, income: 0, expenses: serviceExpenses, profit: -serviceExpenses };
      }).filter(item => item.expenses > 0);
    }

    const groups = new Map<string, ReportRow>();
    incomes.forEach(item => {
      const name = view === "trip" ? item.tripReference : item.truck.registrationNumber;
      const current = groups.get(name) ?? { name, income: 0, expenses: 0, profit: 0 };
      current.income += Number(item.incomeAmount);
      groups.set(name, current);
    });
    expenses.forEach(item => {
      const registration = item.truckId ? truckById.get(item.truckId) : tripTruck.get(item.tripReference);
      const assetName = item.assetType === "trailer" && registration ? `${registration} trailer` : registration;
      const name = view === "trip" ? item.tripReference : assetName ?? "Unassigned";
      const current = groups.get(name) ?? { name, income: 0, expenses: 0, profit: 0 };
      current.expenses += Number(item.amount);
      groups.set(name, current);
    });
    return Array.from(groups.values()).map(item => ({ ...item, profit: item.income - item.expenses }));
  }, [view, incomes, expenses, trucks, totalIncome, totalExpenses, tripTruck, truckById]);

  const exportRows = rows.map(item => ({ Report: item.name, "Income (TZS)": item.income, "Expenses (TZS)": item.expenses, "Profit / Loss (TZS)": item.profit }));
  const reportTitle = view === "global" ? "Global Profit & Loss" : view === "trip" ? "Trip-wise Profit & Loss" : view === "truck" ? "Truck-wise Profit & Loss" : "Service & Maintenance Report";

  return (
    <div className="page-enter">
      <PageHeader eyebrow="Management accounts" title="Profit & loss" description="Compare income and operating costs globally, by trip, by truck, or for maintenance activity." action={<div className="flex gap-2"><button type="button" className={secondaryButton} onClick={() => exportPdf(`kway-${view}-report`, reportTitle, [["Report", "Income", "Expenses", "Profit / Loss"], ...rows.map(row => [row.name, money(row.income), money(row.expenses), money(row.profit)])])}><Download className="size-3.5" />PDF</button><button type="button" className={secondaryButton} onClick={() => exportExcel(`kway-${view}-report`, "P&L Report", exportRows)}><FileSpreadsheet className="size-3.5" />Excel</button></div>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={TrendingUp} label="Global income" value={money(totalIncome)} detail={`${incomes.length} revenue records`} tone="green" />
        <MetricCard icon={TrendingDown} label="Global expenses" value={money(totalExpenses)} detail={`${expenses.length} expense records`} tone="red" />
        <MetricCard icon={Scale} label="Net profit / loss" value={money(totalIncome - totalExpenses)} detail={totalIncome - totalExpenses >= 0 ? "Positive operating position" : "Costs exceed recorded income"} tone={totalIncome - totalExpenses >= 0 ? "navy" : "red"} />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#edf0ee] px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-extrabold text-[#24384b]">{reportTitle}</h2><p className="mt-1 text-[10px] text-[#8a949b]">Amounts shown in Tanzanian shillings</p></div><div className="flex flex-wrap gap-1 rounded-xl bg-[#f3f5f2] p-1">{(["global", "trip", "truck", "service"] as ReportTab[]).map(item => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-2 text-[9px] font-extrabold uppercase transition-colors ${view === item ? "bg-white text-[#c9580e] shadow-sm" : "text-[#7a858e]"}`}>{item === "service" ? "Service & maintenance" : item === "global" ? "Global" : `Trip wise`.replace("Trip", item === "truck" ? "Truck" : "Trip")}</button>)}</div></div>

        {rows.length === 0 ? <EmptyState icon={Wrench} title={view === "service" ? "No maintenance expenses" : "No report data yet"} description="This report will calculate automatically when income and expense records are available." /> : (
          <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1.15fr]">
            <div className="h-72 rounded-2xl bg-[#fafbf9] p-3">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0, 10)} margin={{ top: 12, right: 8, left: 0, bottom: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebe8" /><XAxis dataKey="name" tick={{ fontSize: 9, fill: "#7b858d" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#7b858d" }} axisLine={false} tickLine={false} width={58} tickFormatter={value => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 12, borderColor: "#e3e7e5", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="income" name="Income" fill="#173a55" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#ed7d2b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead><tr className="text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="pb-3">Report</th><th className="pb-3 text-right">Income</th><th className="pb-3 text-right">Expenses</th><th className="pb-3 text-right">Profit / loss</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{rows.map(row => <tr key={row.name} className="text-[10px]"><td className="py-4 pr-4 font-extrabold text-[#2b4053]">{row.name}</td><td className="py-4 text-right text-[#536370]">{money(row.income)}</td><td className="py-4 text-right text-[#536370]">{money(row.expenses)}</td><td className={`py-4 text-right font-extrabold ${row.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(row.profit)}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </Panel>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e1e5e3] bg-white p-5 text-xs text-[#64727e]"><BarChart3 className="mt-0.5 size-4 shrink-0 text-[#d66214]" /><p className="leading-5">Reports calculate from all saved income and expense records. Service and maintenance includes expense types containing maintenance, service, or tyre.</p></div>
    </div>
  );
}
