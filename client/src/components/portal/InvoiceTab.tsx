import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  DialogActions,
  EmptyState,
  Field,
  MetricCard,
  PageHeader,
  Panel,
  inputClass,
  primaryButton,
  secondaryButton,
  textareaClass,
} from "./PortalUI";
import type { InvoiceRecord } from "./utils";
import { shortDate } from "./utils";

const KWAY_NAME = "K-WAY LIMITED";
const KWAY_TIN = "180-047-603";
const DEFAULT_BANK_DETAILS = "Bank name:\nAccount name: K-WAY LIMITED\nUSD account number:\nSWIFT code:";

type InvoiceItemDraft = {
  key: string;
  description: string;
  numberOfTrucks: string;
  unitPrice: string;
};

const newItem = (): InvoiceItemDraft => ({
  key: crypto.randomUUID(),
  description: "",
  numberOfTrucks: "1",
  unitPrice: "",
});

const emptyForm = () => ({
  customerName: "",
  customerTin: "",
  customerVrn: "",
  containerNumber: "",
  bankDetails: DEFAULT_BANK_DETAILS,
  notes: "",
});

const usd = (value: number | string) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
}).format(Number(value));

export default function InvoiceTab({ invoices, isLoading }: { invoices: InvoiceRecord[]; isLoading: boolean }) {
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState<InvoiceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<InvoiceItemDraft[]>([newItem()]);

  const createInvoice = trpc.portal.invoices.create.useMutation({
    onSuccess: async result => {
      await utils.portal.invoices.list.invalidate();
      setAddOpen(false);
      setForm(emptyForm());
      setItems([newItem()]);
      toast.success("Invoice created", { description: result.invoiceNumber });
    },
    onError: error => toast.error("Could not create invoice", { description: error.message }),
  });
  const deleteInvoice = trpc.portal.invoices.delete.useMutation({
    onSuccess: async () => {
      await utils.portal.invoices.list.invalidate();
      setViewing(null);
      toast.success("Invoice deleted");
    },
    onError: error => toast.error("Could not delete invoice", { description: error.message }),
  });

  const totalBilled = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const totalTrucks = invoices.reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.numberOfTrucks, 0), 0);
  const draftTotal = items.reduce((sum, item) => sum + Number(item.numberOfTrucks || 0) * Number(item.unitPrice || 0), 0);

  const openCreate = () => {
    setForm(emptyForm());
    setItems([newItem()]);
    setAddOpen(true);
  };

  const updateItem = (key: string, values: Partial<InvoiceItemDraft>) => {
    setItems(current => current.map(item => item.key === key ? { ...item, ...values } : item));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedItems = items.map(item => ({
      description: item.description.trim(),
      numberOfTrucks: Number(item.numberOfTrucks),
      unitPrice: Number(item.unitPrice),
    }));
    if (normalizedItems.some(item => !item.description || !item.numberOfTrucks || !item.unitPrice)) {
      toast.error("Complete every invoice line");
      return;
    }
    createInvoice.mutate({
      customerName: form.customerName,
      customerTin: form.customerTin,
      customerVrn: form.customerVrn,
      containerNumber: form.containerNumber || undefined,
      bankDetails: form.bankDetails,
      notes: form.notes || undefined,
      items: normalizedItems,
    });
  };

  const confirmDelete = (invoice: InvoiceRecord) => {
    if (window.confirm(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) {
      deleteInvoice.mutate({ id: invoice.id });
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Customer billing"
        title="Invoices"
        description="Create USD tax invoices with automatic numbering, customer tax details, container references, and K-Way bank instructions."
        action={<button type="button" onClick={openCreate} className={primaryButton}><Plus className="size-4" />Create invoice</button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={ReceiptText} label="Invoices" value={String(invoices.length)} detail="Automatically numbered records" tone="navy" />
        <MetricCard icon={FileText} label="Total billed" value={usd(totalBilled)} detail="All invoices in USD" tone="green" />
        <MetricCard icon={Building2} label="Truck units billed" value={String(totalTrucks)} detail="Across invoice line items" tone="orange" />
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4">
          <div><h2 className="text-sm font-extrabold text-[#24384b]">Invoice register</h2><p className="mt-1 text-[10px] text-[#8a949b]">View, download, and manage customer invoices</p></div>
          <span className="rounded-full bg-[#eaf0f5] px-3 py-1.5 text-[9px] font-extrabold text-[#173753]">USD</span>
        </div>
        {isLoading ? <div className="h-56 animate-pulse bg-white" /> : invoices.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No invoices created" description="Create the first K-Way customer invoice with automatic date and invoice number." actionLabel="Create invoice" onAction={openCreate} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead><tr className="bg-[#fafbf9] text-[9px] font-extrabold tracking-[0.1em] text-[#89939a] uppercase"><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">TIN / VRN</th><th className="px-5 py-3">Container</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Lines</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#edf0ee]">
                {invoices.map(invoice => <tr key={invoice.id} className="text-[10px] text-[#536370] hover:bg-[#fafbf9]"><td className="px-5 py-4 font-extrabold text-[#18354f]">{invoice.invoiceNumber}</td><td className="px-5 py-4 font-bold text-[#30475a]">{invoice.customerName}</td><td className="px-5 py-4"><p>{invoice.customerTin}</p><p className="mt-1 text-[#89939a]">VRN {invoice.customerVrn}</p></td><td className="px-5 py-4">{invoice.containerNumber || "—"}</td><td className="px-5 py-4">{shortDate(invoice.invoiceDate)}</td><td className="px-5 py-4">{invoice.items.length}</td><td className="px-5 py-4 text-right font-extrabold text-[#24384b]">{usd(invoice.totalAmount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setViewing(invoice)} className="text-[#76828b] hover:text-[#17354f]" aria-label={`View ${invoice.invoiceNumber}`}><Eye className="size-4" /></button><button type="button" onClick={() => exportInvoicePdf(invoice)} className="text-[#76828b] hover:text-[#c9580e]" aria-label={`Download ${invoice.invoiceNumber} PDF`}><FileText className="size-4" /></button><button type="button" onClick={() => exportInvoiceExcel(invoice)} className="text-[#76828b] hover:text-emerald-700" aria-label={`Download ${invoice.invoiceNumber} Excel`}><FileSpreadsheet className="size-4" /></button><button type="button" onClick={() => confirmDelete(invoice)} className="text-[#76828b] hover:text-red-600" aria-label={`Delete ${invoice.invoiceNumber}`}><Trash2 className="size-4" /></button></div></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[94vh] w-[96vw] !max-w-[1180px] overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#f9faf7]">
          <DialogHeader><DialogTitle className="font-display text-3xl font-bold text-[#15324b] uppercase">Create invoice</DialogTitle><DialogDescription>The invoice number and date are generated automatically when this record is saved.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="mt-4 space-y-5">
            <div className="grid gap-4 rounded-2xl bg-[#10263c] p-5 text-white md:grid-cols-[1fr_auto]">
              <div><p className="text-[9px] font-extrabold tracking-[0.2em] text-[#ff9a4b] uppercase">Issued by</p><h3 className="font-display mt-2 text-3xl font-bold uppercase">{KWAY_NAME}</h3><p className="mt-2 text-xs text-white/65">TIN: {KWAY_TIN} · Currency: USD</p></div>
              <div className="grid grid-cols-2 gap-3 text-right md:block"><div><p className="text-[9px] font-bold text-white/45 uppercase">Invoice number</p><p className="mt-1 text-xs font-extrabold">Generated on save</p></div><div className="md:mt-4"><p className="text-[9px] font-bold text-white/45 uppercase">Invoice date</p><p className="mt-1 text-xs font-extrabold">{shortDate(Date.now())}</p></div></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Customer name"><input required className={inputClass} value={form.customerName} onChange={event => setForm(current => ({ ...current, customerName: event.target.value }))} placeholder="Customer or company" /></Field>
              <Field label="Customer TIN number"><input required className={inputClass} value={form.customerTin} onChange={event => setForm(current => ({ ...current, customerTin: event.target.value }))} placeholder="TIN number" /></Field>
              <Field label="Customer VRN number"><input required className={inputClass} value={form.customerVrn} onChange={event => setForm(current => ({ ...current, customerVrn: event.target.value }))} placeholder="VRN number" /></Field>
              <div className="sm:col-span-2 lg:col-span-3"><Field label="Container number(s)" hint="Optional"><input className={inputClass} value={form.containerNumber} onChange={event => setForm(current => ({ ...current, containerNumber: event.target.value }))} placeholder="e.g. MSCU 1234567, TGHU 7654321" /></Field></div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#24384b]">Invoice lines</h3><p className="mt-1 text-[10px] text-[#8a949b]">Total price is calculated automatically as trucks × unit price</p></div><button type="button" onClick={() => setItems(current => [...current, newItem()])} className={secondaryButton}><Plus className="size-3.5" />Add line</button></div>
              <div className="hidden grid-cols-[1fr_150px_180px_180px_40px] gap-3 px-3 pb-2 text-[9px] font-extrabold tracking-[0.1em] text-[#7c878f] uppercase md:grid"><span>Description</span><span>Number of trucks</span><span>Unit price</span><span>Total price</span><span /></div>
              <div className="space-y-3">{items.map((item, index) => {
                const lineTotal = Number(item.numberOfTrucks || 0) * Number(item.unitPrice || 0);
                return <div key={item.key} className="grid gap-3 rounded-2xl border border-[#e2e6e4] bg-white p-3 md:grid-cols-[1fr_150px_180px_180px_40px] md:items-start"><InvoiceRow label="Description"><input required className={`${inputClass} h-10 text-xs`} value={item.description} onChange={event => updateItem(item.key, { description: event.target.value })} placeholder="Transport service description" /></InvoiceRow><InvoiceRow label="Number of trucks"><input required min="1" step="1" type="number" className={`${inputClass} h-10 text-xs`} value={item.numberOfTrucks} onChange={event => updateItem(item.key, { numberOfTrucks: event.target.value })} /></InvoiceRow><InvoiceRow label="Unit price (USD)"><input required min="0.01" step="0.01" type="number" className={`${inputClass} h-10 text-xs`} value={item.unitPrice} onChange={event => updateItem(item.key, { unitPrice: event.target.value })} placeholder="0.00" /></InvoiceRow><InvoiceRow label="Total price"><div className="flex h-10 items-center rounded-xl border border-[#d9e6df] bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800">{usd(lineTotal)}</div></InvoiceRow><div className="flex h-10 items-center justify-center">{items.length > 1 ? <button type="button" onClick={() => setItems(current => current.filter(currentItem => currentItem.key !== item.key))} className="flex size-8 items-center justify-center rounded-lg text-[#8a949b] hover:bg-red-50 hover:text-red-600" aria-label={`Remove invoice line ${index + 1}`}><Trash2 className="size-4" /></button> : null}</div></div>;
              })}</div>
              <div className="mt-3 flex justify-end"><div className="min-w-72 rounded-2xl bg-[#10263c] px-5 py-4 text-white"><div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-[0.12em] text-white/55 uppercase">Invoice total</span><span className="font-display text-2xl font-bold">{usd(draftTotal)}</span></div></div></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="K-Way bank details"><textarea required className={`${textareaClass} h-36`} value={form.bankDetails} onChange={event => setForm(current => ({ ...current, bankDetails: event.target.value }))} placeholder="Bank name, account name, USD account number and SWIFT code" /></Field>
              <Field label="Notes" hint="Optional"><textarea className={`${textareaClass} h-36`} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Payment terms or additional invoice notes" /></Field>
            </div>
            <DialogActions onCancel={() => setAddOpen(false)} submitLabel="Create invoice" busy={createInvoice.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-h-[94vh] w-[96vw] !max-w-4xl overflow-y-auto rounded-2xl border-[#e1e5e3] bg-[#eef0ed]">
          <DialogHeader className="sr-only"><DialogTitle>Invoice preview</DialogTitle><DialogDescription>Review and download the selected invoice.</DialogDescription></DialogHeader>
          {viewing ? <InvoicePreview invoice={viewing} /> : null}
          {viewing ? <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => exportInvoicePdf(viewing)} className={secondaryButton}><Download className="size-3.5" />Download PDF</button><button type="button" onClick={() => exportInvoiceExcel(viewing)} className={secondaryButton}><FileSpreadsheet className="size-3.5" />Download Excel</button><button type="button" onClick={() => confirmDelete(viewing)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-extrabold text-red-700 hover:bg-red-100"><Trash2 className="size-3.5" />Delete invoice</button></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoicePreview({ invoice }: { invoice: InvoiceRecord }) {
  return <article className="rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,35,50,0.12)] sm:p-8"><div className="flex flex-col gap-5 border-b-2 border-[#10263c] pb-6 sm:flex-row sm:items-start sm:justify-between"><div><span className="inline-flex size-11 items-center justify-center rounded-xl bg-[#ff8c35] text-[#10263c]"><Landmark className="size-5" /></span><h2 className="font-display mt-3 text-4xl font-bold text-[#10263c] uppercase">{KWAY_NAME}</h2><p className="mt-2 text-xs font-bold text-[#61717d]">TIN: {KWAY_TIN}</p></div><div className="sm:text-right"><p className="font-display text-4xl font-bold text-[#d66214] uppercase">Invoice</p><p className="mt-2 text-sm font-extrabold text-[#24384b]">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-[#78848d]">{shortDate(invoice.invoiceDate)} · {invoice.currency}</p></div></div><div className="grid gap-5 py-6 sm:grid-cols-2"><div className="rounded-2xl bg-[#f5f7f4] p-4"><p className="text-[9px] font-extrabold tracking-[0.15em] text-[#d66214] uppercase">Bill to</p><p className="mt-2 text-base font-extrabold text-[#24384b]">{invoice.customerName}</p><p className="mt-2 text-xs text-[#61717d]">TIN: {invoice.customerTin}</p><p className="mt-1 text-xs text-[#61717d]">VRN: {invoice.customerVrn}</p></div><div className="rounded-2xl bg-[#f5f7f4] p-4"><p className="text-[9px] font-extrabold tracking-[0.15em] text-[#d66214] uppercase">Shipment</p><p className="mt-2 text-xs font-bold text-[#24384b]">Container number(s)</p><p className="mt-1 text-xs text-[#61717d]">{invoice.containerNumber || "Not specified"}</p></div></div><div className="overflow-x-auto rounded-2xl border border-[#e2e6e4]"><table className="w-full min-w-[620px] text-left"><thead><tr className="bg-[#10263c] text-[9px] font-extrabold tracking-[0.1em] text-white uppercase"><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-center">Trucks</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-4 py-3 text-right">Total price</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{invoice.items.map(item => <tr key={item.id} className="text-xs text-[#536370]"><td className="px-4 py-4 font-bold text-[#30475a]">{item.description}</td><td className="px-4 py-4 text-center">{item.numberOfTrucks}</td><td className="px-4 py-4 text-right">{usd(item.unitPrice)}</td><td className="px-4 py-4 text-right font-extrabold text-[#24384b]">{usd(item.totalPrice)}</td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="min-w-72 rounded-2xl bg-[#10263c] p-5 text-white"><div className="flex items-center justify-between gap-8"><span className="text-[10px] font-bold tracking-[0.12em] text-white/55 uppercase">Total due</span><span className="font-display text-3xl font-bold">{usd(invoice.totalAmount)}</span></div></div></div><div className="mt-6 grid gap-4 border-t border-[#e2e6e4] pt-5 sm:grid-cols-2"><div><p className="flex items-center gap-2 text-[9px] font-extrabold tracking-[0.12em] text-[#d66214] uppercase"><Landmark className="size-3.5" />Bank details</p><p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#536370]">{invoice.bankDetails}</p></div>{invoice.notes ? <div><p className="text-[9px] font-extrabold tracking-[0.12em] text-[#d66214] uppercase">Notes</p><p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#536370]">{invoice.notes}</p></div> : null}</div></article>;
}

function InvoiceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-[9px] font-extrabold tracking-[0.08em] text-[#7c878f] uppercase md:hidden">{label}</span>{children}</label>;
}

async function exportInvoicePdf(invoice: InvoiceRecord) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const left = 15;
  const right = 195;
  const navy: [number, number, number] = [16, 38, 60];
  const orange: [number, number, number] = [230, 103, 26];
  const gray: [number, number, number] = [92, 105, 116];

  document.setFillColor(...navy);
  document.rect(0, 0, pageWidth, 43, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(21);
  document.text(KWAY_NAME, left, 18);
  document.setFontSize(9);
  document.setFont("helvetica", "normal");
  document.text(`TIN: ${KWAY_TIN}`, left, 26);
  document.setFont("helvetica", "bold");
  document.setFontSize(25);
  document.text("INVOICE", right, 17, { align: "right" });
  document.setFontSize(9);
  document.text(invoice.invoiceNumber, right, 25, { align: "right" });
  document.setFont("helvetica", "normal");
  document.text(`${shortDate(invoice.invoiceDate)}  ·  ${invoice.currency}`, right, 32, { align: "right" });

  document.setTextColor(...orange);
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.text("BILL TO", left, 55);
  document.text("SHIPMENT", 111, 55);
  document.setTextColor(...navy);
  document.setFontSize(12);
  document.text(invoice.customerName, left, 63);
  document.setFontSize(9);
  document.setFont("helvetica", "normal");
  document.setTextColor(...gray);
  document.text(`TIN: ${invoice.customerTin}`, left, 70);
  document.text(`VRN: ${invoice.customerVrn}`, left, 76);
  document.setTextColor(...navy);
  document.setFont("helvetica", "bold");
  document.text("Container number(s)", 111, 63);
  document.setFont("helvetica", "normal");
  document.setTextColor(...gray);
  document.text(document.splitTextToSize(invoice.containerNumber || "Not specified", 83), 111, 70);

  let y = 88;
  const drawTableHeader = () => {
    document.setFillColor(...navy);
    document.rect(left, y, right - left, 10, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(8);
    document.text("Description", left + 3, y + 6.5);
    document.text("Trucks", 130, y + 6.5, { align: "right" });
    document.text("Unit price", 160, y + 6.5, { align: "right" });
    document.text("Total", right - 3, y + 6.5, { align: "right" });
    y += 10;
  };
  drawTableHeader();

  for (const item of invoice.items) {
    const descriptionLines = document.splitTextToSize(item.description, 90);
    const rowHeight = Math.max(12, descriptionLines.length * 5 + 5);
    if (y + rowHeight > 245) {
      document.addPage();
      y = 18;
      drawTableHeader();
    }
    document.setDrawColor(226, 230, 228);
    document.setFillColor(250, 251, 249);
    document.rect(left, y, right - left, rowHeight, "FD");
    document.setTextColor(...navy);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.text(descriptionLines, left + 3, y + 7);
    document.text(String(item.numberOfTrucks), 130, y + 7, { align: "right" });
    document.text(usd(item.unitPrice), 160, y + 7, { align: "right" });
    document.setFont("helvetica", "bold");
    document.text(usd(item.totalPrice), right - 3, y + 7, { align: "right" });
    y += rowHeight;
  }

  y += 7;
  document.setFillColor(...orange);
  document.roundedRect(116, y, 79, 17, 3, 3, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.text("TOTAL DUE", 122, y + 7);
  document.setFontSize(15);
  document.text(usd(invoice.totalAmount), 190, y + 11, { align: "right" });
  y += 27;

  if (y > 245) {
    document.addPage();
    y = 20;
  }
  document.setTextColor(...orange);
  document.setFontSize(8);
  document.text("K-WAY BANK DETAILS", left, y);
  document.setTextColor(...gray);
  document.setFont("helvetica", "normal");
  document.setFontSize(8.5);
  const bankLines = document.splitTextToSize(invoice.bankDetails, 83);
  document.text(bankLines, left, y + 7);
  if (invoice.notes) {
    document.setTextColor(...orange);
    document.setFont("helvetica", "bold");
    document.text("NOTES", 111, y);
    document.setTextColor(...gray);
    document.setFont("helvetica", "normal");
    document.text(document.splitTextToSize(invoice.notes, 83), 111, y + 7);
  }
  document.setDrawColor(226, 230, 228);
  document.line(left, 282, right, 282);
  document.setTextColor(...gray);
  document.setFontSize(7.5);
  document.text(`${KWAY_NAME} · TIN ${KWAY_TIN} · Invoice ${invoice.invoiceNumber}`, left, 288);
  document.save(`${invoice.invoiceNumber}.pdf`);
}

async function exportInvoiceExcel(invoice: InvoiceRecord) {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    [KWAY_NAME],
    [`TIN: ${KWAY_TIN}`],
    [],
    ["INVOICE NUMBER", invoice.invoiceNumber, "DATE", shortDate(invoice.invoiceDate)],
    ["CURRENCY", invoice.currency],
    [],
    ["CUSTOMER NAME", invoice.customerName],
    ["CUSTOMER TIN", invoice.customerTin, "CUSTOMER VRN", invoice.customerVrn],
    ["CONTAINER NUMBER(S)", invoice.containerNumber || "Not specified"],
    [],
    ["DESCRIPTION", "NUMBER OF TRUCKS", "UNIT PRICE (USD)", "TOTAL PRICE (USD)"],
    ...invoice.items.map(item => [item.description, item.numberOfTrucks, Number(item.unitPrice), Number(item.totalPrice)]),
    [],
    ["", "", "TOTAL DUE (USD)", Number(invoice.totalAmount)],
    [],
    ["K-WAY BANK DETAILS"],
    ...invoice.bankDetails.split("\n").map(line => [line]),
    ...(invoice.notes ? [[""], ["NOTES"], ...invoice.notes.split("\n").map(line => [line])] : []),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 52 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice");
  XLSX.writeFile(workbook, `${invoice.invoiceNumber}.xlsx`);
}
