import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, FileCheck2, FileText, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DialogActions, EmptyState, Field, FilePicker, PageHeader, Panel, StatusPill, inputClass, primaryButton } from "./PortalUI";
import type { TruckRecord, UploadPayload } from "./utils";
import { dateInputToUtc, filesToPayload, shortDate, toDateInput } from "./utils";

const DOCUMENT_TYPES = [
  "Truck Registration Card",
  "Truck Insurance",
  "Trailer Insurance",
  "Trailer Card",
  "LATRA – Truck",
  "LATRA – Trailer",
  "COMESA – Truck",
  "COMESA – Trailer",
  "VIR",
  "C28 – Trailer",
  "Driver Licence",
  "Driver Passport",
];

const emptyTruck = { registrationNumber: "", model: "", driverName: "", driverPhone: "" };

export default function TrucksTab({ trucks, isLoading }: { trucks: TruckRecord[]; isLoading: boolean }) {
  const utils = trpc.useUtils();
  const [truckDialogOpen, setTruckDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);
  const [truckForm, setTruckForm] = useState(emptyTruck);
  const [documentTruck, setDocumentTruck] = useState<TruckRecord | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [expiryDate, setExpiryDate] = useState(toDateInput(Date.now() + 365 * 86400000));
  const [file, setFile] = useState<UploadPayload | null>(null);

  const createTruck = trpc.portal.trucks.create.useMutation({
    onSuccess: async () => {
      await utils.portal.trucks.list.invalidate();
      setTruckDialogOpen(false);
      setTruckForm(emptyTruck);
      toast.success("Truck added to the fleet");
    },
    onError: error => toast.error("Could not add truck", { description: error.message }),
  });
  const updateTruck = trpc.portal.trucks.update.useMutation({
    onSuccess: async () => {
      await utils.portal.trucks.list.invalidate();
      setTruckDialogOpen(false);
      setEditingTruck(null);
      setTruckForm(emptyTruck);
      toast.success("Truck details updated");
    },
    onError: error => toast.error("Could not update truck", { description: error.message }),
  });
  const addDocument = trpc.portal.trucks.addDocument.useMutation({
    onSuccess: async () => {
      await utils.portal.trucks.list.invalidate();
      setDocumentTruck(null);
      setFile(null);
      toast.success("Truck document saved", { description: "The 14-day expiry monitor is now active." });
    },
    onError: error => toast.error("Could not save document", { description: error.message }),
  });
  const deleteDocument = trpc.portal.trucks.deleteDocument.useMutation({
    onSuccess: () => utils.portal.trucks.list.invalidate(),
    onError: error => toast.error("Could not delete document", { description: error.message }),
  });

  const openCreate = () => {
    setEditingTruck(null);
    setTruckForm(emptyTruck);
    setTruckDialogOpen(true);
  };

  const openEdit = (truck: TruckRecord) => {
    setEditingTruck(truck);
    setTruckForm({
      registrationNumber: truck.registrationNumber,
      model: truck.model,
      driverName: truck.driverName,
      driverPhone: truck.driverPhone,
    });
    setTruckDialogOpen(true);
  };

  const saveTruck = (event: FormEvent) => {
    event.preventDefault();
    if (editingTruck) updateTruck.mutate({ id: editingTruck.id, ...truckForm });
    else createTruck.mutate(truckForm);
  };

  const saveDocument = (event: FormEvent) => {
    event.preventDefault();
    if (!documentTruck || !file) {
      toast.error("Select a document file before saving");
      return;
    }
    addDocument.mutate({
      truckId: documentTruck.id,
      documentType,
      expiryDate: dateInputToUtc(expiryDate),
      file,
    });
  };

  const statusFor = (date: number) => {
    const days = Math.ceil((date - Date.now()) / 86400000);
    if (days < 0) return "expired" as const;
    if (days <= 14) return "warning" as const;
    return "valid" as const;
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Fleet registry"
        title="Trucks"
        description="Maintain vehicle assignments and keep critical truck, trailer, and driver documents compliant."
        action={<button type="button" className={primaryButton} onClick={openCreate}><Plus className="size-4" />Add truck</button>}
      />

      {isLoading ? <Panel className="h-64 animate-pulse bg-white/70" /> : trucks.length === 0 ? (
        <Panel><EmptyState icon={Truck} title="No trucks in the fleet yet" description="Add your first truck, driver details, and compliance documents to begin managing trips." actionLabel="Add first truck" onAction={openCreate} /></Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {trucks.map(truck => {
            const alerts = truck.documents.filter(document => statusFor(document.expiryDate) !== "valid").length;
            return (
              <Panel key={truck.id} className="overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-[#edf0ee] p-5">
                  <div className="flex gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#10263c] text-[#ff8c35]"><Truck className="size-5" /></div>
                    <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl font-bold tracking-wide text-[#17354f] uppercase">{truck.registrationNumber}</h2>{alerts > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700"><AlertTriangle className="size-3" />{alerts} alert{alerts === 1 ? "" : "s"}</span> : null}</div><p className="mt-1 text-xs font-semibold text-[#687681]">{truck.model}</p></div>
                  </div>
                  <button type="button" onClick={() => openEdit(truck)} className="flex size-9 items-center justify-center rounded-xl border border-[#e1e5e3] text-[#64727e] transition-colors hover:text-[#c9580e]" aria-label={`Edit ${truck.registrationNumber}`}><Pencil className="size-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-[#fafbf9] px-5 py-4">
                  <div><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8c969c] uppercase">Assigned driver</p><p className="mt-1 text-xs font-bold text-[#35495c]">{truck.driverName}</p></div>
                  <div><p className="text-[9px] font-extrabold tracking-[0.1em] text-[#8c969c] uppercase">Telephone</p><p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#35495c]"><Phone className="size-3 text-[#db681d]" />{truck.driverPhone}</p></div>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-extrabold text-[#2f4355]">Documents</h3><p className="mt-0.5 text-[9px] text-[#8b959c]">{truck.documents.length} uploaded</p></div><button type="button" onClick={() => setDocumentTruck(truck)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#fff0e4] px-3 text-[10px] font-extrabold text-[#bd510a] transition-colors hover:bg-[#ffe5d2]"><Plus className="size-3.5" />Add document</button></div>
                  {truck.documents.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#dfe4e2] p-4"><FileText className="size-4 text-[#9aa3a8]" /><p className="text-[10px] text-[#7b858d]">No documents attached to this truck.</p></div>
                  ) : (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {truck.documents.map(document => (
                        <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e8ebe9] px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-3"><FileCheck2 className="size-4 shrink-0 text-[#d66214]" /><div className="min-w-0"><a href={document.fileUrl} target="_blank" rel="noreferrer" className="block truncate text-[10px] font-extrabold text-[#33485a] hover:text-[#c9580e]">{document.documentType}</a><p className="mt-0.5 truncate text-[9px] text-[#8a949b]">Expires {shortDate(document.expiryDate)} · {document.fileName}</p></div></div>
                          <div className="flex shrink-0 items-center gap-2"><StatusPill status={statusFor(document.expiryDate)} /><button type="button" onClick={() => window.confirm(`Delete ${document.documentType}?`) && deleteDocument.mutate({ id: document.id })} className="text-[#9ba4aa] hover:text-red-600" aria-label={`Delete ${document.documentType}`}><Trash2 className="size-3.5" /></button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={truckDialogOpen} onOpenChange={setTruckDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">{editingTruck ? "Edit truck" : "Add truck"}</DialogTitle><DialogDescription>Enter the vehicle and assigned driver details.</DialogDescription></DialogHeader>
          <form onSubmit={saveTruck} className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Registration number"><input required className={inputClass} value={truckForm.registrationNumber} onChange={event => setTruckForm(current => ({ ...current, registrationNumber: event.target.value }))} placeholder="T 123 ABC" /></Field>
            <Field label="Truck model"><input required className={inputClass} value={truckForm.model} onChange={event => setTruckForm(current => ({ ...current, model: event.target.value }))} placeholder="Volvo FH16" /></Field>
            <Field label="Truck driver"><input required className={inputClass} value={truckForm.driverName} onChange={event => setTruckForm(current => ({ ...current, driverName: event.target.value }))} placeholder="Driver's full name" /></Field>
            <Field label="Driver telephone"><input required type="tel" className={inputClass} value={truckForm.driverPhone} onChange={event => setTruckForm(current => ({ ...current, driverPhone: event.target.value }))} placeholder="+255 7XX XXX XXX" /></Field>
            <div className="sm:col-span-2"><DialogActions onCancel={() => setTruckDialogOpen(false)} submitLabel={editingTruck ? "Save changes" : "Add truck"} busy={createTruck.isPending || updateTruck.isPending} /></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentTruck)} onOpenChange={open => !open && setDocumentTruck(null)}>
        <DialogContent className="max-w-xl rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Add truck document</DialogTitle><DialogDescription>{documentTruck?.registrationNumber} · expiry alerts begin 14 days before the selected date.</DialogDescription></DialogHeader>
          <form onSubmit={saveDocument} className="mt-3 space-y-4">
            <Field label="Document type"><select className={inputClass} value={documentType} onChange={event => setDocumentType(event.target.value)}>{DOCUMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></Field>
            <Field label="Expiry date"><input required type="date" className={inputClass} value={expiryDate} onChange={event => setExpiryDate(event.target.value)} /></Field>
            <FilePicker multiple={false} label={file ? file.name : "Choose document"} onChange={async files => setFile((await filesToPayload(files))[0] ?? null)} />
            <DialogActions onCancel={() => setDocumentTruck(null)} submitLabel="Save document" busy={addDocument.isPending} />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
