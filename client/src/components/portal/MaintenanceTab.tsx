import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { CalendarClock, Eye, Gauge, Paperclip, Pencil, Plus, Settings, Trash2, Truck, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DialogActions, EmptyState, Field, FilePicker, MetricCard, PageHeader, Panel, StatusPill, inputClass, primaryButton, textareaClass } from "./PortalUI";
import type { MaintenanceRecord, TruckRecord, UploadPayload } from "./utils";
import { dateInputToUtc, filesToPayload, money, shortDate, toDateInput } from "./utils";

const MAINTENANCE_TYPES = ["Routine service", "Engine repair", "Brake service", "Tyres", "Electrical repair", "Body repair", "Suspension", "Trailer repair"];
const CUSTOM_TYPE = "__custom__";

const emptyForm = {
  truckId: "",
  assetType: "truck" as "truck" | "trailer",
  serviceDate: toDateInput(),
  maintenanceType: "Routine service",
  customType: "",
  description: "",
  amount: "",
  workshop: "",
  odometerKm: "",
  nextServiceDate: "",
};

export default function MaintenanceTab({
  records,
  trucks,
  isLoading,
}: {
  records: MaintenanceRecord[];
  trucks: TruckRecord[];
  isLoading: boolean;
}) {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [viewing, setViewing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [attachments, setAttachments] = useState<UploadPayload[]>([]);

  const invalidate = async () => {
    await Promise.all([
      utils.portal.maintenance.list.invalidate(),
      utils.portal.expenses.list.invalidate(),
      utils.portal.expenses.types.invalidate(),
    ]);
  };

  const createRecord = trpc.portal.maintenance.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setAttachments([]);
      toast.success("Maintenance record saved", { description: "The cost is now included in Expenses." });
    },
    onError: error => toast.error("Could not save maintenance", { description: error.message }),
  });
  const updateRecord = trpc.portal.maintenance.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      setEditing(null);
      toast.success("Maintenance record updated");
    },
    onError: error => toast.error("Could not update maintenance", { description: error.message }),
  });
  const deleteRecord = trpc.portal.maintenance.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Maintenance record and linked expense deleted");
    },
    onError: error => toast.error("Could not delete maintenance", { description: error.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, truckId: trucks[0] ? String(trucks[0].id) : "" });
    setAttachments([]);
    setDialogOpen(true);
  };

  const openEdit = (record: MaintenanceRecord) => {
    setEditing(record);
    const knownType = MAINTENANCE_TYPES.includes(record.expense.expenseType);
    setForm({
      truckId: String(record.truckId),
      assetType: record.assetType,
      serviceDate: toDateInput(record.expense.expenseDate),
      maintenanceType: knownType ? record.expense.expenseType : CUSTOM_TYPE,
      customType: knownType ? "" : record.expense.expenseType,
      description: record.expense.description,
      amount: String(record.expense.amount),
      workshop: record.workshop ?? "",
      odometerKm: record.odometerKm ? String(record.odometerKm) : "",
      nextServiceDate: record.nextServiceDate ? toDateInput(record.nextServiceDate) : "",
    });
    setAttachments([]);
    setDialogOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const maintenanceType = form.maintenanceType === CUSTOM_TYPE ? form.customType.trim() : form.maintenanceType;
    if (!form.truckId || !maintenanceType || !form.description || !form.amount) {
      toast.error("Complete all required maintenance fields");
      return;
    }
    const payload = {
      truckId: Number(form.truckId),
      assetType: form.assetType,
      serviceDate: dateInputToUtc(form.serviceDate),
      maintenanceType,
      description: form.description,
      amount: Number(form.amount),
      workshop: form.workshop || undefined,
      odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
      nextServiceDate: form.nextServiceDate ? dateInputToUtc(form.nextServiceDate) : undefined,
      attachments,
    };
    if (editing) updateRecord.mutate({ id: editing.id, expenseId: editing.expenseId, ...payload });
    else createRecord.mutate(payload);
  };

  const total = records.reduce((sum, item) => sum + Number(item.expense.amount), 0);
  const truckTotal = records.filter(item => item.assetType === "truck").reduce((sum, item) => sum + Number(item.expense.amount), 0);
  const trailerTotal = records.filter(item => item.assetType === "trailer").reduce((sum, item) => sum + Number(item.expense.amount), 0);
  const upcoming = records.filter(item => item.nextServiceDate && item.nextServiceDate <= Date.now() + 30 * 86400000).length;

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Fleet care"
        title="Maintenance"
        description="Record truck and trailer service work. Every saved maintenance cost is automatically added to Expenses against the selected asset."
        action={<button type="button" className={primaryButton} onClick={openCreate}><Plus className="size-4" />Add maintenance</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wrench} label="Maintenance cost" value={money(total)} detail={`${records.length} service record${records.length === 1 ? "" : "s"}`} tone="orange" />
        <MetricCard icon={Truck} label="Truck maintenance" value={money(truckTotal)} detail={`${records.filter(item => item.assetType === "truck").length} truck records`} tone="navy" />
        <MetricCard icon={Settings} label="Trailer maintenance" value={money(trailerTotal)} detail={`${records.filter(item => item.assetType === "trailer").length} trailer records`} tone="green" />
        <MetricCard icon={CalendarClock} label="Service attention" value={String(upcoming)} detail="Due within the next 30 days" tone={upcoming ? "red" : "navy"} />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Service history</h2><p className="mt-1 text-[10px] text-[#8a949b]">Truck and trailer work with linked financial costs</p></div>
          <span className="rounded-full bg-[#fff0e4] px-3 py-1.5 text-[9px] font-extrabold text-[#bd510a]">Auto-linked to Expenses</span>
        </div>
        {isLoading ? <div className="h-56 animate-pulse" /> : records.length === 0 ? (
          <EmptyState icon={Wrench} title="No maintenance recorded" description="Add the first truck or trailer service to start building asset service history." actionLabel={trucks.length ? "Add maintenance" : undefined} onAction={trucks.length ? openCreate : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Service date</th><th className="px-5 py-3">Work type</th><th className="px-5 py-3">Workshop</th><th className="px-5 py-3">Odometer</th><th className="px-5 py-3">Next service</th><th className="px-5 py-3">Files</th><th className="px-5 py-3 text-right">Cost</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#edf0ee]">{records.map(record => <tr key={record.id} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4"><p className="font-extrabold text-[#2b4053]">{record.truck.registrationNumber}</p><div className="mt-1"><StatusPill status={record.assetType === "truck" ? "going" : "return"} /></div></td><td className="px-5 py-4">{shortDate(record.expense.expenseDate)}</td><td className="px-5 py-4 font-bold text-[#35495c]">{record.expense.expenseType}</td><td className="px-5 py-4">{record.workshop || "—"}</td><td className="px-5 py-4">{record.odometerKm ? `${record.odometerKm.toLocaleString()} km` : "—"}</td><td className="px-5 py-4">{shortDate(record.nextServiceDate)}</td><td className="px-5 py-4">{record.expense.attachments.length ? <a href={record.expense.attachments[0].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#c9580e]"><Paperclip className="size-3" />{record.expense.attachments.length}</a> : "—"}</td><td className="px-5 py-4 text-right font-extrabold text-[#24384b]">{money(record.expense.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setViewing(record)} className="text-[#76828b] hover:text-[#17354f]" aria-label="View maintenance"><Eye className="size-4" /></button><button type="button" onClick={() => openEdit(record)} className="text-[#76828b] hover:text-[#c9580e]" aria-label="Edit maintenance"><Pencil className="size-4" /></button><button type="button" onClick={() => window.confirm("Delete this maintenance record and its linked expense?") && deleteRecord.mutate({ expenseId: record.expenseId })} className="text-[#76828b] hover:text-red-600" aria-label="Delete maintenance"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">{editing ? "Edit maintenance" : "Add maintenance"}</DialogTitle><DialogDescription>The amount will also appear in Expenses under the selected truck or trailer.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Truck"><select required className={inputClass} value={form.truckId} onChange={event => setForm(current => ({ ...current, truckId: event.target.value }))}><option value="" disabled>Select truck</option>{trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.registrationNumber} · {truck.model}</option>)}</select></Field>
            <Field label="Asset"><select className={inputClass} value={form.assetType} onChange={event => setForm(current => ({ ...current, assetType: event.target.value as "truck" | "trailer" }))}><option value="truck">Truck</option><option value="trailer">Trailer</option></select></Field>
            <Field label="Service date"><input required type="date" className={inputClass} value={form.serviceDate} onChange={event => setForm(current => ({ ...current, serviceDate: event.target.value }))} /></Field>
            <Field label="Maintenance type"><select className={inputClass} value={form.maintenanceType} onChange={event => setForm(current => ({ ...current, maintenanceType: event.target.value, customType: "" }))}>{MAINTENANCE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}<option value={CUSTOM_TYPE}>+ Custom maintenance type</option></select></Field>
            {form.maintenanceType === CUSTOM_TYPE ? <Field label="Custom type"><input required className={inputClass} value={form.customType} onChange={event => setForm(current => ({ ...current, customType: event.target.value }))} placeholder="Enter maintenance type" /></Field> : null}
            <Field label="Amount (TZS)"><input required min="1" step="0.01" type="number" className={inputClass} value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="0" /></Field>
            <Field label="Workshop / supplier"><input className={inputClass} value={form.workshop} onChange={event => setForm(current => ({ ...current, workshop: event.target.value }))} placeholder="Workshop name" /></Field>
            <Field label="Odometer (km)" hint="Truck only"><input min="0" type="number" className={inputClass} value={form.odometerKm} onChange={event => setForm(current => ({ ...current, odometerKm: event.target.value }))} placeholder="Optional" /></Field>
            <Field label="Next service date"><input type="date" className={inputClass} value={form.nextServiceDate} onChange={event => setForm(current => ({ ...current, nextServiceDate: event.target.value }))} /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><textarea required className={textareaClass} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Describe work completed, parts used, and service notes" /></Field></div>
            <div className="sm:col-span-2 lg:col-span-3"><FilePicker label={attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} selected` : "Add invoices, receipts, or service documents"} onChange={async files => setAttachments(await filesToPayload(files))} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><DialogActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? "Save changes" : "Save maintenance"} busy={createRecord.isPending || updateRecord.isPending} /></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Service detail</DialogTitle><DialogDescription>{viewing?.truck.registrationNumber} · {viewing?.assetType}</DialogDescription></DialogHeader>
          {viewing ? <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><Detail label="Service date" value={shortDate(viewing.expense.expenseDate)} /><Detail label="Type" value={viewing.expense.expenseType} /><Detail label="Workshop" value={viewing.workshop || "—"} /><Detail label="Cost" value={money(viewing.expense.amount)} /><Detail label="Odometer" value={viewing.odometerKm ? `${viewing.odometerKm.toLocaleString()} km` : "—"} /><Detail label="Next service" value={shortDate(viewing.nextServiceDate)} /><div className="col-span-2"><Detail label="Description" value={viewing.expense.description} /></div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e4e8e6] bg-white p-3"><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8b959c] uppercase">{label}</p><p className="mt-1 font-bold text-[#2f4356]">{value}</p></div>;
}
