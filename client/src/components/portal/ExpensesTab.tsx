import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, Eye, FileSpreadsheet, Paperclip, Pencil, Plus, ReceiptText, Trash2, TrendingDown } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DialogActions, EmptyState, Field, FilePicker, MetricCard, PageHeader, Panel, inputClass, primaryButton, secondaryButton, textareaClass } from "./PortalUI";
import type { ExpenseRecord, IncomeRecord, UploadPayload } from "./utils";
import { dateInputToUtc, exportExcel, exportPdf, filesToPayload, money, shortDate, toDateInput } from "./utils";

type ReportView = "all" | "trip" | "truck" | "type";
type ExpenseDraft = {
  key: string;
  tripReference: string;
  expenseDate: string;
  expenseType: string;
  customType: string;
  description: string;
  amount: string;
  attachments: UploadPayload[];
};

const TYPES = ["Fuel", "Road toll", "Driver allowance", "Border fee", "Maintenance", "Tyres", "Accommodation", "Other"];
const newDraft = (tripReference = ""): ExpenseDraft => ({ key: crypto.randomUUID(), tripReference, expenseDate: toDateInput(), expenseType: "Fuel", customType: "", description: "", amount: "", attachments: [] });

export default function ExpensesTab({ expenses, incomes, isLoading }: { expenses: ExpenseRecord[]; incomes: IncomeRecord[]; isLoading: boolean }) {
  const utils = trpc.useUtils();
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [viewing, setViewing] = useState<ExpenseRecord | null>(null);
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([newDraft()]);
  const [reportView, setReportView] = useState<ReportView>("all");

  const references = Array.from(new Set(incomes.map(item => item.tripReference)));
  const tripTruck = new Map(incomes.map(item => [item.tripReference, item.truck.registrationNumber]));
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const createMany = trpc.portal.expenses.createMany.useMutation({
    onSuccess: async result => {
      await utils.portal.expenses.list.invalidate();
      setEntryOpen(false);
      setDrafts([newDraft(references[0] ?? "")]);
      toast.success(`${result.ids.length} expense record${result.ids.length === 1 ? "" : "s"} saved`);
    },
    onError: error => toast.error("Could not save expenses", { description: error.message }),
  });
  const updateExpense = trpc.portal.expenses.update.useMutation({
    onSuccess: async () => {
      await utils.portal.expenses.list.invalidate();
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
      expenseType: TYPES.includes(expense.expenseType) ? expense.expenseType : "Other",
      customType: TYPES.includes(expense.expenseType) ? "" : expense.expenseType,
      description: expense.description,
      amount: String(expense.amount),
      attachments: [],
    }]);
    setEntryOpen(true);
  };

  const updateDraft = (key: string, values: Partial<ExpenseDraft>) => setDrafts(current => current.map(item => item.key === key ? { ...item, ...values } : item));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const records = drafts.map(item => ({
      tripReference: item.tripReference,
      expenseDate: dateInputToUtc(item.expenseDate),
      expenseType: item.expenseType === "Other" ? item.customType : item.expenseType,
      description: item.description,
      amount: Number(item.amount),
      attachments: item.attachments,
    }));
    if (records.some(item => !item.tripReference || !item.expenseType || !item.description || !item.amount)) return toast.error("Complete every required expense field");
    if (editing) updateExpense.mutate({ id: editing.id, ...records[0] });
    else createMany.mutate({ records });
  };

  const groupedRows = useMemo(() => {
    if (reportView === "all") return expenses.map(item => ({ key: String(item.id), label: item.description, sublabel: `${item.tripReference} · ${item.expenseType}`, amount: Number(item.amount), count: 1, source: item }));
    const grouped = new Map<string, { amount: number; count: number }>();
    expenses.forEach(item => {
      const key = reportView === "trip" ? item.tripReference : reportView === "truck" ? tripTruck.get(item.tripReference) ?? "Unassigned" : item.expenseType;
      const current = grouped.get(key) ?? { amount: 0, count: 0 };
      grouped.set(key, { amount: current.amount + Number(item.amount), count: current.count + 1 });
    });
    return Array.from(grouped.entries()).map(([key, value]) => ({ key, label: key, sublabel: `${value.count} expense record${value.count === 1 ? "" : "s"}`, amount: value.amount, count: value.count, source: null }));
  }, [expenses, reportView, tripTruck]);

  const exportRows = expenses.map(item => ({
    "Trip Reference": item.tripReference,
    Truck: tripTruck.get(item.tripReference) ?? "—",
    Date: shortDate(item.expenseDate),
    Type: item.expenseType,
    Description: item.description,
    "Amount (TZS)": Number(item.amount),
  }));

  return (
    <div className="page-enter">
      <PageHeader eyebrow="Cost control" title="Expenses" description="Capture trip costs in batches, attach receipts, and review expenses by trip, truck, or category." action={<button type="button" onClick={openCreate} className={primaryButton}><Plus className="size-4" />Record expense</button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={TrendingDown} label="Total expenses" value={money(totalExpenses)} detail="All recorded operating costs" tone="red" />
        <MetricCard icon={ReceiptText} label="Expense records" value={String(expenses.length)} detail="Across linked trips" tone="navy" />
        <MetricCard icon={FileSpreadsheet} label="Average expense" value={money(expenses.length ? totalExpenses / expenses.length : 0)} detail="Average per expense line" tone="orange" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#edf0ee] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Expense report</h2><p className="mt-1 text-[10px] text-[#8a949b]">View records or aggregate them for analysis</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-[#f3f5f2] p-1">{(["all", "trip", "truck", "type"] as ReportView[]).map(item => <button key={item} type="button" onClick={() => setReportView(item)} className={`rounded-lg px-3 py-2 text-[9px] font-extrabold uppercase transition-colors ${reportView === item ? "bg-white text-[#c9580e] shadow-sm" : "text-[#7a858e]"}`}>{item === "all" ? "All expenses" : `By ${item}`}</button>)}</div>
            <button type="button" className={secondaryButton} onClick={() => exportPdf("kway-expenses", "K-Way Limited Expense Report", [["Trip", "Truck", "Date", "Type", "Description", "Amount"], ...exportRows.map(row => [row["Trip Reference"], row.Truck, row.Date, row.Type, row.Description, money(row["Amount (TZS)"])])])}><Download className="size-3.5" />PDF</button>
            <button type="button" className={secondaryButton} onClick={() => exportExcel("kway-expenses", "Expenses", exportRows)}><Download className="size-3.5" />Excel</button>
          </div>
        </div>

        {isLoading ? <div className="h-56 animate-pulse" /> : groupedRows.length === 0 ? <EmptyState icon={ReceiptText} title="No expenses recorded" description="Expense records and reports will appear after costs are added against a trip." actionLabel={references.length ? "Record expense" : undefined} onAction={references.length ? openCreate : undefined} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">{reportView === "all" ? "Description" : `Grouped by ${reportView}`}</th><th className="px-5 py-3">Details</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Files</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{groupedRows.map(row => <tr key={row.key} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#2b4053]">{row.label}</td><td className="px-5 py-4">{row.sublabel}</td><td className="px-5 py-4">{row.source ? shortDate(row.source.expenseDate) : "—"}</td><td className="px-5 py-4">{row.source?.attachments.length ? <a href={row.source.attachments[0].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#c9580e]"><Paperclip className="size-3" />{row.source.attachments.length}</a> : "—"}</td><td className="px-5 py-4 text-right font-extrabold text-[#24384b]">{money(row.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{row.source ? <><button type="button" onClick={() => setViewing(row.source)} className="text-[#76828b] hover:text-[#17354f]" aria-label="View expense"><Eye className="size-4" /></button><button type="button" onClick={() => openEdit(row.source)} className="text-[#76828b] hover:text-[#c9580e]" aria-label="Edit expense"><Pencil className="size-4" /></button><button type="button" onClick={() => window.confirm("Delete this expense record?") && deleteExpense.mutate({ id: row.source!.id })} className="text-[#76828b] hover:text-red-600" aria-label="Delete expense"><Trash2 className="size-4" /></button></> : "—"}</div></td></tr>)}</tbody></table></div>
        )}
      </Panel>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">{editing ? "Edit expense" : "Record expenses"}</DialogTitle><DialogDescription>{editing ? "Update this cost record and optionally attach additional documents." : "Add one or multiple expense lines before saving the batch."}</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="mt-3 space-y-4">
            {drafts.map((draft, index) => <div key={draft.key} className="rounded-2xl border border-[#e2e6e4] bg-white p-4"><div className="mb-4 flex items-center justify-between"><p className="text-[10px] font-extrabold tracking-[0.12em] text-[#d66214] uppercase">Expense {index + 1}</p>{!editing && drafts.length > 1 ? <button type="button" onClick={() => setDrafts(current => current.filter(item => item.key !== draft.key))} className="text-[#8a949b] hover:text-red-600"><Trash2 className="size-4" /></button> : null}</div><div className="grid gap-4 md:grid-cols-3">
              <Field label="Trip reference"><select required className={inputClass} value={draft.tripReference} onChange={event => updateDraft(draft.key, { tripReference: event.target.value })}><option value="" disabled>Select trip</option>{references.map(reference => <option key={reference} value={reference}>{reference}</option>)}</select></Field>
              <Field label="Date of expense"><input required type="date" className={inputClass} value={draft.expenseDate} onChange={event => updateDraft(draft.key, { expenseDate: event.target.value })} /></Field>
              <Field label="Expense type"><select className={inputClass} value={draft.expenseType} onChange={event => updateDraft(draft.key, { expenseType: event.target.value })}>{TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></Field>
              {draft.expenseType === "Other" ? <Field label="Custom expense type"><input required className={inputClass} value={draft.customType} onChange={event => updateDraft(draft.key, { customType: event.target.value })} placeholder="Enter type" /></Field> : null}
              <Field label="Amount (TZS)"><input required min="1" step="0.01" type="number" className={inputClass} value={draft.amount} onChange={event => updateDraft(draft.key, { amount: event.target.value })} placeholder="0" /></Field>
              <div className={draft.expenseType === "Other" ? "md:col-span-3" : "md:col-span-2"}><Field label="Description"><textarea required className={textareaClass} value={draft.description} onChange={event => updateDraft(draft.key, { description: event.target.value })} placeholder="Describe the expense" /></Field></div>
              <div className="md:col-span-3"><FilePicker label={draft.attachments.length ? `${draft.attachments.length} attachment${draft.attachments.length === 1 ? "" : "s"} selected` : "Add multiple attachments"} onChange={async files => updateDraft(draft.key, { attachments: await filesToPayload(files) })} /></div>
            </div></div>)}
            {!editing ? <button type="button" className={secondaryButton} onClick={() => setDrafts(current => [...current, newDraft(references[0] ?? "")])}><Plus className="size-3.5" />Add another expense</button> : null}
            <DialogActions onCancel={() => setEntryOpen(false)} submitLabel={editing ? "Save changes" : `Save ${drafts.length} expense${drafts.length === 1 ? "" : "s"}`} busy={createMany.isPending || updateExpense.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Expense detail</DialogTitle><DialogDescription>{viewing?.tripReference}</DialogDescription></DialogHeader>
          {viewing ? <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><Detail label="Date" value={shortDate(viewing.expenseDate)} /><Detail label="Type" value={viewing.expenseType} /><Detail label="Truck" value={tripTruck.get(viewing.tripReference) ?? "—"} /><Detail label="Amount" value={money(viewing.amount)} /><div className="col-span-2"><Detail label="Description" value={viewing.description} /></div><div className="col-span-2"><p className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">Attachments</p>{viewing.attachments.length ? <div className="space-y-2">{viewing.attachments.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#e1e5e3] bg-white p-3 font-bold text-[#c9580e]"><Paperclip className="size-3.5" />{file.fileName}</a>)}</div> : <p className="text-[#7a858e]">No attachments</p>}</div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e4e8e6] bg-white p-3"><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">{label}</p><p className="mt-1 font-bold text-[#2f4356]">{value}</p></div>;
}
