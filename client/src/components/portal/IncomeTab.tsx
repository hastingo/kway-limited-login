import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ArchiveRestore, CircleDollarSign, Eye, FileText, Flag, PackageCheck, Paperclip, Plus, Route, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { DialogActions, EmptyState, Field, FilePicker, MetricCard, PageHeader, Panel, StatusPill, inputClass, primaryButton, textareaClass } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, TruckRecord, UploadPayload } from "./utils";
import { dateInputToUtc, filesToPayload, money, shortDate, toDateInput } from "./utils";

type RecordFilter = "all" | "going" | "return" | "ended";

const emptyIncome = {
  cargoType: "going" as "going" | "return",
  tripReference: "",
  truckId: "",
  dateOfLoading: toDateInput(),
  customerName: "",
  containerNumber: "",
  destination: "",
  incomeAmount: "",
  description: "",
};

export default function IncomeTab({ incomes, trucks, expenses, isLoading }: { incomes: IncomeRecord[]; trucks: TruckRecord[]; expenses: ExpenseRecord[]; isLoading: boolean }) {
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [endTrip, setEndTrip] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(toDateInput());
  const [filter, setFilter] = useState<RecordFilter>("all");
  const [form, setForm] = useState(emptyIncome);
  const [attachments, setAttachments] = useState<UploadPayload[]>([]);
  const [viewTrip, setViewTrip] = useState<string | null>(null);

  const createIncome = trpc.portal.income.create.useMutation({
    onSuccess: async result => {
      await utils.portal.income.list.invalidate();
      setAddOpen(false);
      setForm(emptyIncome);
      setAttachments([]);
      toast.success("Income record created", { description: `Trip reference ${result.tripReference}` });
    },
    onError: error => toast.error("Could not save income", { description: error.message }),
  });
  const setStatus = trpc.portal.income.setStatus.useMutation({
    onSuccess: async (_, variables) => {
      await utils.portal.income.list.invalidate();
      setEndTrip(null);
      toast.success(variables.status === "ended" ? "Trip completed" : "Trip reactivated");
    },
    onError: error => toast.error("Could not update trip", { description: error.message }),
  });
  const deleteTrip = trpc.portal.income.deleteTrip.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.portal.income.list.invalidate(),
        utils.portal.expenses.list.invalidate(),
      ]);
      setViewTrip(null);
      toast.success("Trip deleted", { description: "Linked cargo records and trip expenses were removed." });
    },
    onError: error => toast.error("Could not delete trip", { description: error.message }),
  });

  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.incomeAmount), 0);
  const references = Array.from(new Set(incomes.filter(item => item.cargoType === "going").map(item => item.tripReference)));
  const activeGroups = useMemo(() => {
    const grouped = new Map<string, IncomeRecord[]>();
    incomes.filter(item => item.status === "active").forEach(item => grouped.set(item.tripReference, [...(grouped.get(item.tripReference) ?? []), item]));
    return Array.from(grouped.entries());
  }, [incomes]);
  const endedGroups = new Set(incomes.filter(item => item.status === "ended").map(item => item.tripReference));
  const filtered = incomes.filter(item => filter === "all" || filter === "ended" ? (filter === "all" || item.status === "ended") : item.cargoType === filter);
  const viewedRecords = viewTrip ? incomes.filter(item => item.tripReference === viewTrip) : [];
  const viewedExpenses = viewTrip ? expenses.filter(item => item.tripReference === viewTrip) : [];
  const viewedExpenseTotal = viewedExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const viewedFuelLiters = viewedExpenses.reduce((sum, item) => sum + Number(item.fuelLiters ?? 0), 0);
  const selectedTruck = trucks.find(truck => truck.id === Number(form.truckId));
  const pieData = [
    { name: "Going cargo", value: incomes.filter(item => item.cargoType === "going").reduce((sum, item) => sum + Number(item.incomeAmount), 0), color: "#153852" },
    { name: "Return cargo", value: incomes.filter(item => item.cargoType === "return").reduce((sum, item) => sum + Number(item.incomeAmount), 0), color: "#ed7d2b" },
  ].filter(item => item.value > 0);

  const submitIncome = (event: FormEvent) => {
    event.preventDefault();
    if (!form.truckId) return toast.error("Select a truck");
    createIncome.mutate({
      cargoType: form.cargoType,
      tripReference: form.cargoType === "return" ? form.tripReference : undefined,
      truckId: Number(form.truckId),
      dateOfLoading: dateInputToUtc(form.dateOfLoading),
      customerName: form.customerName,
      containerNumber: form.containerNumber,
      destination: form.destination,
      incomeAmount: Number(form.incomeAmount),
      description: form.description,
      attachments,
    });
  };

  const changeCargoType = (cargoType: "going" | "return") => {
    const tripReference = cargoType === "return" ? references[0] ?? "" : "";
    const linkedTruck = incomes.find(item => item.tripReference === tripReference)?.truck.id;
    setForm(current => ({ ...current, cargoType, tripReference, truckId: cargoType === "return" ? String(linkedTruck ?? "") : "" }));
  };

  const changeReturnReference = (tripReference: string) => {
    const linkedTruck = incomes.find(item => item.tripReference === tripReference)?.truck.id;
    setForm(current => ({ ...current, tripReference, truckId: String(linkedTruck ?? "") }));
  };

  const confirmDeleteTrip = (tripReference: string) => {
    const linkedRecords = incomes.filter(item => item.tripReference === tripReference).length;
    if (window.confirm(`Delete ${tripReference}? This permanently removes ${linkedRecords} cargo record${linkedRecords === 1 ? "" : "s"}, attachments, and linked trip expenses.`)) {
      deleteTrip.mutate({ tripReference });
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Revenue & trips"
        title="Income"
        description="Record cargo revenue, link return loads to existing trips, and manage the active trip lifecycle."
        action={<button type="button" onClick={() => { setForm(emptyIncome); setAttachments([]); setAddOpen(true); }} className={primaryButton}><Plus className="size-4" />Add income</button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={CircleDollarSign} label="Total income" value={money(totalIncome)} detail="Across all cargo records" tone="green" />
        <MetricCard icon={FileText} label="Total records" value={String(incomes.length)} detail={`${references.length} generated trip references`} tone="navy" />
        <MetricCard icon={Route} label="Active trips" value={String(activeGroups.length)} detail={`${endedGroups.size} ended trips`} tone="orange" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4"><div><h2 className="text-sm font-extrabold text-[#24384b]">Active trips</h2><p className="mt-1 text-[10px] text-[#8a949b]">Trucks currently committed to a container movement</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-extrabold text-emerald-700">{activeGroups.length} active</span></div>
          {activeGroups.length === 0 ? <EmptyState icon={Route} title="No active trips" description="Create a going cargo income record to activate a trip." /> : (
            <div className="divide-y divide-[#edf0ee]">
              {activeGroups.slice(0, 5).map(([reference, records]) => {
                const main = records[0];
                const tripIncome = records.reduce((sum, item) => sum + Number(item.incomeAmount), 0);
                return <div key={reference} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="text-xs font-extrabold text-[#18354f]">{reference}</span><StatusPill status="active" /></div><p className="mt-1.5 text-[10px] text-[#74808a]">{main.truck.registrationNumber} · {main.containerNumber} · {main.destination}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-xs font-extrabold text-[#24384b]">{money(tripIncome)}</span><button type="button" onClick={() => setViewTrip(reference)} className="flex size-8 items-center justify-center rounded-lg border border-[#e1e5e3] text-[#61717e] hover:text-[#17354f]" aria-label={`View ${reference}`}><Eye className="size-3.5" /></button><button type="button" onClick={() => { setEndTrip(reference); setReturnDate(toDateInput()); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#fff0e4] px-3 text-[10px] font-extrabold text-[#bd510a] hover:bg-[#ffe4d0]"><Flag className="size-3.5" />End trip</button><button type="button" onClick={() => confirmDeleteTrip(reference)} className="flex size-8 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${reference}`}><Trash2 className="size-3.5" /></button></div></div>;
              })}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Income by cargo type</h2><p className="mt-1 text-[10px] text-[#8a949b]">Share of recorded revenue</p></div>
          <div className="mt-3 h-44">
            {pieData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={5} stroke="none">{pieData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 12, borderColor: "#e3e7e5", fontSize: 11 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8f5] text-xs text-[#8b959c]">No income data yet</div>}
          </div>
          <div className="space-y-2">{pieData.map(item => <div key={item.name} className="flex items-center justify-between rounded-xl bg-[#f7f8f5] px-3 py-2.5"><span className="flex items-center gap-2 text-[10px] font-bold text-[#596975]"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="text-[10px] font-extrabold text-[#273b4e]">{money(item.value)}</span></div>)}</div>
        </Panel>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#edf0ee] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold text-[#24384b]">Income records</h2><p className="mt-1 text-[10px] text-[#8a949b]">Review going cargo, return cargo, and completed trips</p></div><div className="flex gap-1 rounded-xl bg-[#f3f5f2] p-1">{(["all", "going", "return", "ended"] as RecordFilter[]).map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-[9px] font-extrabold uppercase transition-colors ${filter === item ? "bg-white text-[#c9580e] shadow-sm" : "text-[#7a858e]"}`}>{item}</button>)}</div></div>
        {isLoading ? <div className="h-52 animate-pulse bg-white" /> : filtered.length === 0 ? <EmptyState icon={PackageCheck} title="No matching income records" description="Records matching this filter will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Trip reference</th><th className="px-5 py-3">Cargo</th><th className="px-5 py-3">Truck / container</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Destination</th><th className="px-5 py-3">Loaded</th><th className="px-5 py-3">Container returned</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Files</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-[#edf0ee]">
                {filtered.map(item => <tr key={item.id} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#18354f]">{item.tripReference}</td><td className="px-5 py-4"><StatusPill status={item.cargoType} /></td><td className="px-5 py-4"><p className="font-bold text-[#35495c]">{item.truck.registrationNumber}</p><p className="mt-1 text-[#8a949b]">{item.containerNumber}</p></td><td className="px-5 py-4">{item.customerName}</td><td className="px-5 py-4">{item.destination}</td><td className="px-5 py-4">{shortDate(item.dateOfLoading)}</td><td className="px-5 py-4 font-semibold">{shortDate(item.returnedAt)}</td><td className="px-5 py-4"><StatusPill status={item.status} /></td><td className="px-5 py-4">{item.attachments.length ? <a href={item.attachments[0].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#c9580e]"><Paperclip className="size-3" />{item.attachments.length}</a> : "—"}</td><td className="px-5 py-4 text-right font-extrabold text-[#24384b]">{money(item.incomeAmount)}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><button type="button" onClick={() => setViewTrip(item.tripReference)} className="text-[#76828b] hover:text-[#17354f]" aria-label={`View ${item.tripReference}`}><Eye className="size-4" /></button>{item.status === "ended" ? <button type="button" onClick={() => setStatus.mutate({ tripReference: item.tripReference, status: "active" })} className="inline-flex items-center gap-1 font-extrabold text-[#c9580e]"><ArchiveRestore className="size-3.5" />Reactivate</button> : null}<button type="button" onClick={() => confirmDeleteTrip(item.tripReference)} className="text-[#76828b] hover:text-red-600" aria-label={`Delete ${item.tripReference}`}><Trash2 className="size-4" /></button></div></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Add income</DialogTitle><DialogDescription>Create a going or return cargo record. New going trips receive a short reference such as TRIP-0001.</DialogDescription></DialogHeader>
          <form onSubmit={submitIncome} className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Cargo type"><select className={inputClass} value={form.cargoType} onChange={event => changeCargoType(event.target.value as "going" | "return")}><option value="going">Going cargo</option><option value="return">Return cargo</option></select></Field>
            <Field label="Trip reference" hint={form.cargoType === "going" ? "Automatic" : undefined}>{form.cargoType === "going" ? <input disabled className={`${inputClass} bg-[#eef1ef] text-[#7e898f]`} value="TRIP-0001 format" /> : <select required className={inputClass} value={form.tripReference} onChange={event => changeReturnReference(event.target.value)}><option value="" disabled>Select existing trip</option>{references.map(reference => <option key={reference} value={reference}>{reference}</option>)}</select>}</Field>
            <Field label="Truck" hint={form.cargoType === "return" ? "From original trip" : undefined}><select required disabled={form.cargoType === "return"} className={`${inputClass} disabled:bg-[#eef1ef] disabled:text-[#596975]`} value={form.truckId} onChange={event => setForm(current => ({ ...current, truckId: event.target.value }))}><option value="" disabled>Select truck</option>{trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.registrationNumber} · {truck.model}</option>)}</select></Field>
            <Field label="Date of loading"><input required type="date" className={inputClass} value={form.dateOfLoading} onChange={event => setForm(current => ({ ...current, dateOfLoading: event.target.value }))} /></Field>
            {selectedTruck ? <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-[#dfe5e2] bg-white p-4 sm:grid-cols-4"><TripDetail label="Registration" value={selectedTruck.registrationNumber} /><TripDetail label="Truck model" value={selectedTruck.model} /><TripDetail label="Driver" value={selectedTruck.driverName} /><TripDetail label="Telephone" value={selectedTruck.driverPhone} /></div> : null}
            <Field label="Customer name"><input required className={inputClass} value={form.customerName} onChange={event => setForm(current => ({ ...current, customerName: event.target.value }))} placeholder="Customer or company" /></Field>
            <Field label="Container number"><input required className={inputClass} value={form.containerNumber} onChange={event => setForm(current => ({ ...current, containerNumber: event.target.value }))} placeholder="MSCU 1234567" /></Field>
            <Field label="Destination"><input required className={inputClass} value={form.destination} onChange={event => setForm(current => ({ ...current, destination: event.target.value }))} placeholder="Final destination" /></Field>
            <Field label="Income amount (TZS)"><input required min="1" step="0.01" type="number" className={inputClass} value={form.incomeAmount} onChange={event => setForm(current => ({ ...current, incomeAmount: event.target.value }))} placeholder="0" /></Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea className={textareaClass} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Cargo or route notes" /></Field></div>
            <div className="sm:col-span-2"><FilePicker label={attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} selected` : "Add multiple attachments"} onChange={async files => setAttachments(await filesToPayload(files))} /></div>
            <div className="sm:col-span-2"><DialogActions onCancel={() => setAddOpen(false)} submitLabel="Save income" busy={createIncome.isPending} /></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewTrip)} onOpenChange={open => !open && setViewTrip(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Trip detail</DialogTitle><DialogDescription>{viewTrip} · {viewedRecords.length} cargo record{viewedRecords.length === 1 ? "" : "s"}</DialogDescription></DialogHeader>
          <div className="mt-3 space-y-3">
            {viewedRecords.map(record => <div key={record.id} className="rounded-2xl border border-[#e2e6e4] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusPill status={record.cargoType} /><StatusPill status={record.status} /></div><span className="text-sm font-extrabold text-[#24384b]">{money(record.incomeAmount)}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><TripDetail label="Truck" value={record.truck.registrationNumber} /><TripDetail label="Truck model" value={record.truck.model} /><TripDetail label="Driver" value={record.truck.driverName} /><TripDetail label="Driver telephone" value={record.truck.driverPhone} /><TripDetail label="Container" value={record.containerNumber} /><TripDetail label="Customer" value={record.customerName} /><TripDetail label="Destination" value={record.destination} /><TripDetail label="Loaded" value={shortDate(record.dateOfLoading)} /><TripDetail label="Container returned" value={shortDate(record.returnedAt)} /></div>{record.description ? <p className="mt-3 rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-[#536370]">{record.description}</p> : null}{record.attachments.length ? <div className="mt-3 flex flex-wrap gap-2">{record.attachments.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1e5e3] px-3 py-2 text-[10px] font-bold text-[#c9580e]"><Paperclip className="size-3.5" />{file.fileName}</a>)}</div> : null}</div>)}
          </div>
          <div className="mt-4 rounded-2xl border border-[#e2e6e4] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#24384b]">Trip expenses</h3><p className="mt-1 text-[10px] text-[#8a949b]">Automatically allocated to this trip and truck</p></div><div className="flex gap-2"><span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-extrabold text-red-700">{money(viewedExpenseTotal)}</span><span className="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-extrabold text-sky-700">{viewedFuelLiters.toLocaleString()} L fuel</span></div></div>{viewedExpenses.length ? <div className="mt-3 divide-y divide-[#edf0ee]">{viewedExpenses.map(expense => <div key={expense.id} className="flex items-center justify-between gap-3 py-3 text-xs"><div><p className="font-bold text-[#30475a]">{expense.expenseType}{expense.fuelLiters ? ` · ${Number(expense.fuelLiters).toLocaleString()} L` : ""}</p><p className="mt-1 text-[10px] text-[#89939a]">{shortDate(expense.expenseDate)} · {expense.description}</p></div><span className="font-extrabold text-[#24384b]">{money(expense.amount)}</span></div>)}</div> : <p className="mt-4 rounded-xl bg-[#f7f8f5] p-4 text-center text-xs text-[#89939a]">No expenses recorded for this trip.</p>}</div>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => viewTrip && confirmDeleteTrip(viewTrip)} disabled={deleteTrip.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-4" />Delete trip</button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(endTrip)} onOpenChange={open => !open && setEndTrip(null)}>
        <DialogContent className="max-w-md rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">End trip</DialogTitle><DialogDescription>Confirm the date the container was returned. The truck will become available for a new trip.</DialogDescription></DialogHeader>
          <form onSubmit={event => { event.preventDefault(); if (endTrip) setStatus.mutate({ tripReference: endTrip, status: "ended", returnedAt: dateInputToUtc(returnDate) }); }} className="mt-3">
            <Field label="Container return date"><input required type="date" className={inputClass} value={returnDate} onChange={event => setReturnDate(event.target.value)} /></Field>
            <DialogActions onCancel={() => setEndTrip(null)} submitLabel="End trip" busy={setStatus.isPending} />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TripDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">{label}</p><p className="mt-1 text-xs font-bold text-[#2f4356]">{value}</p></div>;
}
