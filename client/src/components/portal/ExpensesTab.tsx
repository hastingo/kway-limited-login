import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, Droplets, Eye, FileSpreadsheet, Paperclip, Pencil, Plus, ReceiptText, Trash2, TrendingDown } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DialogActions, EmptyState, MetricCard, PageHeader, Panel, inputClass, primaryButton, secondaryButton } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, TruckRecord, UploadPayload } from "./utils";
import { dateInputToUtc, exportExcel, exportPdf, filesToPayload, money, shortDate, toDateInput } from "./utils";

type ReportView = "all" | "trip" | "truck" | "trailer" | "type";
type ExpenseDraft = {
  key: string;
  tripReference: string;
  expenseDate: string;
  expenseType: string;
  customType: string;
  fuelLiters: string;
  description: string;
  amount: string;
  attachments: UploadPayload[];
};

const BASE_TYPES = ["Fuel", "Road toll", "Driver allowance", "Border fee", "Maintenance", "Tyres", "Accommodation"];
const CUSTOM_VALUE = "__custom__";
const newDraft = (tripReference = ""): ExpenseDraft => ({
  key: crypto.randomUUID(),
  tripReference,
  expenseDate: toDateInput(),
  expenseType: "Fuel",
  customType: "",
  fuelLiters: "",
  description: "",
  amount: "",
  attachments: [],
});

export default function ExpensesTab({
  expenses,
  incomes,
  trucks,
  isLoading,
}: {
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  trucks: TruckRecord[];
  isLoading: boolean;
}) {
  const utils = trpc.useUtils();
  const expenseTypesQuery = trpc.portal.expenses.types.useQuery(undefined, { retry: 1 });
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [viewing, setViewing] = useState<ExpenseRecord | null>(null);
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([newDraft()]);
  const [reportView, setReportView] = useState<ReportView>("all");
  const [truckFilter, setTruckFilter] = useState("all");

  const references = Array.from(new Set(incomes.map(item => item.tripReference)));
  const tripDetails = new Map<string, IncomeRecord>();
  incomes.forEach(item => {
    const current = tripDetails.get(item.tripReference);
    if (!current || item.cargoType === "going") tripDetails.set(item.tripReference, item);
  });
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalFuelLiters = expenses.reduce((sum, item) => sum + Number(item.fuelLiters ?? 0), 0);
  const expenseTypeOptions = Array.from(new Set([
    ...BASE_TYPES,
    ...(expenseTypesQuery.data ?? []).map(item => item.name),
    ...expenses.map(item => item.expenseType),
  ])).sort((a, b) => a.localeCompare(b));

  const createMany = trpc.portal.expenses.createMany.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.portal.expenses.list.invalidate(),
        utils.portal.expenses.types.invalidate(),
      ]);
      setEntryOpen(false);
      setDrafts([newDraft(references[0] ?? "")]);
      toast.success(`${result.ids.length} expense record${result.ids.length === 1 ? "" : "s"} saved`);
    },
    onError: error => toast.error("Could not save expenses", { description: error.message }),
  });
  const updateExpense = trpc.portal.expenses.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.portal.expenses.list.invalidate(),
        utils.portal.expenses.types.invalidate(),
      ]);
      setEntryOpen(false);
      setEditing(null);
      toast.success("Expense updated");
    },
    onError: error => toast.error("Could not update expense", { description: error.message }),
  });
  const deleteExpense = trpc.portal.expenses.delete.useMutation({
    onSuccess: async () => {
      await utils.portal.expenses.list.invalidate();
      toast.success("Expense deleted");
    },
    onError: error => toast.error("Could not delete expense", { description: error.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setDrafts([newDraft(references[0] ?? "")]);
    setEntryOpen(true);
  };

  const openEdit = (expense: ExpenseRecord) => {
    setEditing(expense);
    setDrafts([{
      key: String(expense.id),
      tripReference: expense.tripReference,
      expenseDate: toDateInput(expense.expenseDate),
      expenseType: expense.expenseType,
      customType: "",
      fuelLiters: expense.fuelLiters ? String(expense.fuelLiters) : "",
      description: expense.description,
      amount: String(expense.amount),
      attachments: [],
    }]);
    setEntryOpen(true);
  };

  const updateDraft = (key: string, values: Partial<ExpenseDraft>) => {
    setDrafts(current => current.map(item => item.key === key ? { ...item, ...values } : item));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const records = drafts.map(item => {
      const expenseType = item.expenseType === CUSTOM_VALUE ? item.customType.trim() : item.expenseType;
      return {
        tripReference: item.tripReference,
        assetType: "truck" as const,
        expenseDate: dateInputToUtc(item.expenseDate),
        expenseType,
        fuelLiters: expenseType.toLowerCase() === "fuel" ? Number(item.fuelLiters) : null,
        description: item.description,
        amount: Number(item.amount),
        attachments: item.attachments,
      };
    });
    if (records.some(item => !item.tripReference || !tripDetails.has(item.tripReference) || !item.expenseType || !item.description || !item.amount)) {
      toast.error("Complete every required expense field");
      return;
    }
    if (records.some(item => item.expenseType.toLowerCase() === "fuel" && !item.fuelLiters)) {
      toast.error("Enter fuel volume in liters for every fuel expense");
      return;
    }
    if (editing) updateExpense.mutate({ id: editing.id, ...records[0] });
    else createMany.mutate({ records });
  };

  const assetLabel = (item: ExpenseRecord) => {
    const registration = item.truck?.registrationNumber ?? tripDetails.get(item.tripReference)?.truck.registrationNumber;
    if (!registration) return "Unassigned";
    return item.assetType === "trailer" ? `${registration} trailer` : registration;
  };

  const groupedRows = useMemo(() => {
    const filteredByTruck = truckFilter === "all"
      ? expenses
      : expenses.filter(item => String(item.truckId ?? tripDetails.get(item.tripReference)?.truck.id ?? "") === truckFilter);
    if (reportView === "all") {
      return filteredByTruck.map(item => ({
        key: String(item.id),
        label: item.description,
        sublabel: `${item.tripReference} · ${item.expenseType} · ${assetLabel(item)}${item.fuelLiters ? ` · ${Number(item.fuelLiters).toLocaleString()} L` : ""}`,
        amount: Number(item.amount),
        count: 1,
        source: item,
      }));
    }
    const filtered = reportView === "trailer"
      ? filteredByTruck.filter(item => item.assetType === "trailer")
      : reportView === "truck"
        ? filteredByTruck.filter(item => item.assetType !== "trailer")
        : filteredByTruck;
    const grouped = new Map<string, { amount: number; count: number }>();
    filtered.forEach(item => {
      const key = reportView === "trip"
        ? item.tripReference
        : reportView === "type"
          ? item.expenseType
          : assetLabel(item);
      const current = grouped.get(key) ?? { amount: 0, count: 0 };
      grouped.set(key, { amount: current.amount + Number(item.amount), count: current.count + 1 });
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
      key,
      label: key,
      sublabel: `${value.count} expense record${value.count === 1 ? "" : "s"}`,
      amount: value.amount,
      count: value.count,
      source: null,
    }));
  }, [expenses, reportView, truckFilter, tripDetails]);

  const exportRows = expenses.map(item => ({
    "Trip Reference": item.tripReference,
    Asset: assetLabel(item),
    Date: shortDate(item.expenseDate),
    Type: item.expenseType,
    "Fuel Volume (L)": item.fuelLiters ? Number(item.fuelLiters) : "",
    Description: item.description,
    "Amount (TZS)": Number(item.amount),
  }));

  return (
    <div className="page-enter">
      <PageHeader eyebrow="Cost control" title="Expenses" description="Capture trip and maintenance costs in horizontal rows, then review them by trip, truck, trailer, or category." action={<button type="button" onClick={openCreate} className={primaryButton}><Plus className="size-4" />Record expense</button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={TrendingDown} label="Total expenses" value={money(totalExpenses)} detail="Trip, truck, and trailer costs" tone="red" />
        <MetricCard icon={ReceiptText} label="Expense records" value={String(expenses.length)} detail="Including maintenance entries" tone="navy" />
        <MetricCard icon={FileSpreadsheet} label="Average expense" value={money(expenses.length ? totalExpenses / expenses.length : 0)} detail="Average per expense line" tone="orange" />
        <MetricCard icon={Droplets} label="Fuel volume" value={`${totalFuelLiters.toLocaleString()} L`} detail="Captured for fuel analysis" tone="green" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#edf0ee] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Expense report</h2><p className="mt-1 text-[10px] text-[#8a949b]">Maintenance entries are included automatically</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={truckFilter} onChange={event => setTruckFilter(event.target.value)} className="h-10 rounded-xl border border-[#dde2e1] bg-white px-3 text-[10px] font-extrabold text-[#425466] outline-none focus:border-[#e87927]">
              <option value="all">All trucks</option>
              {trucks.map(truck => <option key={truck.id} value={String(truck.id)}>{truck.registrationNumber} · {truck.model}</option>)}
            </select>
            <div className="flex flex-wrap gap-1 rounded-xl bg-[#f3f5f2] p-1">{(["all", "trip", "truck", "trailer", "type"] as ReportView[]).map(item => <button key={item} type="button" onClick={() => setReportView(item)} className={`rounded-lg px-3 py-2 text-[9px] font-extrabold uppercase transition-colors ${reportView === item ? "bg-white text-[#c9580e] shadow-sm" : "text-[#7a858e]"}`}>{item === "all" ? "All expenses" : `By ${item}`}</button>)}</div>
            <button type="button" className={secondaryButton} onClick={() => exportPdf("kway-expenses", "K-Way Limited Expense Report", [["Trip", "Asset", "Date", "Type", "Liters", "Description", "Amount"], ...exportRows.map(row => [row["Trip Reference"], row.Asset, row.Date, row.Type, String(row["Fuel Volume (L)"]), row.Description, money(row["Amount (TZS)"])])])}><Download className="size-3.5" />PDF</button>
            <button type="button" className={secondaryButton} onClick={() => exportExcel("kway-expenses", "Expenses", exportRows)}><Download className="size-3.5" />Excel</button>
          </div>
        </div>

        {isLoading ? <div className="h-56 animate-pulse" /> : groupedRows.length === 0 ? <EmptyState icon={ReceiptText} title="No expenses recorded" description="Expense and maintenance costs will appear here." actionLabel={references.length ? "Record expense" : undefined} onAction={references.length ? openCreate : undefined} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">{reportView === "all" ? "Description" : `Grouped by ${reportView}`}</th><th className="px-5 py-3">Details</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Files</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{groupedRows.map(row => <tr key={row.key} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#2b4053]">{row.label}</td><td className="px-5 py-4">{row.sublabel}</td><td className="px-5 py-4">{row.source ? shortDate(row.source.expenseDate) : "—"}</td><td className="px-5 py-4">{row.source?.attachments.length ? <a href={row.source.attachments[0].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#c9580e]"><Paperclip className="size-3" />{row.source.attachments.length}</a> : "—"}</td><td className="px-5 py-4 text-right font-extrabold text-[#24384b]">{money(row.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{row.source ? <><button type="button" onClick={() => setViewing(row.source)} className="text-[#76828b] hover:text-[#17354f]" aria-label="View expense"><Eye className="size-4" /></button><button type="button" onClick={() => openEdit(row.source)} className="text-[#76828b] hover:text-[#c9580e]" aria-label="Edit expense"><Pencil className="size-4" /></button><button type="button" onClick={() => window.confirm("Delete this expense record?") && deleteExpense.mutate({ id: row.source!.id })} className="text-[#76828b] hover:text-red-600" aria-label="Delete expense"><Trash2 className="size-4" /></button></> : "—"}</div></td></tr>)}</tbody></table></div>
        )}
      </Panel>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-h-[92vh] w-[98vw] !max-w-[98vw] overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7] xl:!max-w-[1540px]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">{editing ? "Edit expense" : "Record expenses"}</DialogTitle><DialogDescription>Selecting a trip automatically allocates the expense to that trip's truck. Fuel rows also capture liters for later GPS mileage analysis.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="hidden grid-cols-[0.95fr_0.7fr_0.72fr_0.82fr_0.55fr_1.05fr_0.65fr_0.55fr_32px] gap-2 px-3 text-[9px] font-extrabold tracking-[0.1em] text-[#7c878f] uppercase lg:grid">
              <span>Trip reference</span><span>Truck</span><span>Date</span><span>Expense type</span><span>Liters</span><span>Description</span><span>Amount</span><span>Attachment</span><span />
            </div>
            {drafts.map((draft, index) => (
              <div key={draft.key} className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e2e6e4] bg-white p-3 lg:grid-cols-[0.95fr_0.7fr_0.72fr_0.82fr_0.55fr_1.05fr_0.65fr_0.55fr_32px] lg:items-start lg:gap-2">
                <RowField label="Trip reference"><select required className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.tripReference} onChange={event => updateDraft(draft.key, { tripReference: event.target.value })}><option value="" disabled>Select trip</option>{references.map(reference => { const trip = tripDetails.get(reference); return <option key={reference} value={reference}>{reference}{trip ? ` · ${trip.truck.registrationNumber}` : ""}</option>; })}</select></RowField>
                <RowField label="Truck">{tripDetails.get(draft.tripReference) ? <div className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[9px] text-emerald-800"><p className="font-extrabold">{tripDetails.get(draft.tripReference)!.truck.registrationNumber} · {tripDetails.get(draft.tripReference)!.truck.model}</p><p className="mt-0.5 truncate text-emerald-700">{tripDetails.get(draft.tripReference)!.truck.driverName}</p></div> : <div className="flex h-10 items-center rounded-xl border border-[#dfe4e2] bg-[#f4f6f3] px-2.5 text-xs font-extrabold text-[#284055]">Select trip</div>}</RowField>
                <RowField label="Date"><input required type="date" className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.expenseDate} onChange={event => updateDraft(draft.key, { expenseDate: event.target.value })} /></RowField>
                <RowField label="Expense type"><select className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.expenseType} onChange={event => updateDraft(draft.key, { expenseType: event.target.value, customType: "" })}>{expenseTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}<option value={CUSTOM_VALUE}>+ Add custom type</option></select>{draft.expenseType === CUSTOM_VALUE ? <input required autoFocus className={`${inputClass} mt-2 h-9 px-2.5 text-xs`} value={draft.customType} onChange={event => updateDraft(draft.key, { customType: event.target.value })} placeholder="Custom type name" /> : null}</RowField>
                <RowField label="Liters">{(draft.expenseType === CUSTOM_VALUE ? draft.customType : draft.expenseType).trim().toLowerCase() === "fuel" ? <input required min="0.01" step="0.01" type="number" className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.fuelLiters} onChange={event => updateDraft(draft.key, { fuelLiters: event.target.value })} placeholder="Liters" /> : <div className="flex h-10 items-center rounded-xl border border-[#e7eae8] bg-[#f7f8f5] px-2.5 text-xs text-[#9aa2a7]">—</div>}</RowField>
                <RowField label="Description"><input required className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.description} onChange={event => updateDraft(draft.key, { description: event.target.value })} placeholder="Expense description" /></RowField>
                <RowField label="Amount"><input required min="1" step="0.01" type="number" className={`${inputClass} h-10 px-2.5 text-xs`} value={draft.amount} onChange={event => updateDraft(draft.key, { amount: event.target.value })} placeholder="TZS" /></RowField>
                <RowField label="Attachment"><label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cfd6d3] bg-[#fafbf9] px-2 text-[9px] font-bold text-[#566673] hover:border-[#e87927]"><Paperclip className="size-3.5 text-[#d66214]" />{draft.attachments.length ? `${draft.attachments.length} file${draft.attachments.length === 1 ? "" : "s"}` : "Add files"}<input type="file" multiple className="sr-only" onChange={async event => event.target.files && updateDraft(draft.key, { attachments: await filesToPayload(event.target.files) })} /></label></RowField>
                <div className="flex h-10 items-center justify-end xl:justify-center">{!editing && drafts.length > 1 ? <button type="button" onClick={() => setDrafts(current => current.filter(item => item.key !== draft.key))} className="flex size-8 items-center justify-center rounded-lg text-[#8a949b] hover:bg-red-50 hover:text-red-600" aria-label={`Remove expense ${index + 1}`}><Trash2 className="size-4" /></button> : null}</div>
              </div>
            ))}
            {!editing ? <button type="button" className={secondaryButton} onClick={() => setDrafts(current => [...current, newDraft(references[0] ?? "")])}><Plus className="size-3.5" />Add another expense row</button> : null}
            <DialogActions onCancel={() => setEntryOpen(false)} submitLabel={editing ? "Save changes" : `Save ${drafts.length} expense${drafts.length === 1 ? "" : "s"}`} busy={createMany.isPending || updateExpense.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Expense detail</DialogTitle><DialogDescription>{viewing?.tripReference}</DialogDescription></DialogHeader>
          {viewing ? <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><Detail label="Date" value={shortDate(viewing.expenseDate)} /><Detail label="Type" value={viewing.expenseType} /><Detail label="Truck / asset" value={assetLabel(viewing)} /><Detail label="Amount" value={money(viewing.amount)} />{viewing.fuelLiters ? <Detail label="Fuel volume" value={`${Number(viewing.fuelLiters).toLocaleString()} liters`} /> : null}<div className="col-span-2"><Detail label="Description" value={viewing.description} /></div><div className="col-span-2"><p className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">Attachments</p>{viewing.attachments.length ? <div className="space-y-2">{viewing.attachments.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#e1e5e3] bg-white p-3 font-bold text-[#c9580e]"><Paperclip className="size-3.5" />{file.fileName}</a>)}</div> : <p className="text-[#7a858e]">No attachments</p>}</div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-[9px] font-extrabold tracking-[0.08em] text-[#7c878f] uppercase lg:hidden">{label}</span>{children}</label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e4e8e6] bg-white p-3"><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">{label}</p><p className="mt-1 font-bold text-[#2f4356]">{value}</p></div>;
}
