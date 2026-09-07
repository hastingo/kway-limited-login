import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type TruckRecord = RouterOutputs["portal"]["trucks"]["list"][number];
export type IncomeRecord = RouterOutputs["portal"]["income"]["list"][number];
export type ExpenseRecord = RouterOutputs["portal"]["expenses"]["list"][number];

export type UploadPayload = {
  name: string;
  type: string;
  dataUrl: string;
};

export const money = (value: number | string) =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value));

export const shortDate = (value: number | Date | string | null | undefined) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

export const toDateInput = (value: number | Date | string = Date.now()) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const dateInputToUtc = (value: string) => new Date(`${value}T12:00:00`).getTime();

export async function filesToPayload(files: FileList | File[]): Promise<UploadPayload[]> {
  return Promise.all(
    Array.from(files).map(
      file =>
        new Promise<UploadPayload>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            name: file.name,
            type: file.type || "application/octet-stream",
            dataUrl: String(reader.result),
          });
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export async function exportExcel(fileName: string, sheetName: string, rows: Record<string, unknown>[]) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export async function exportPdf(fileName: string, title: string, rows: string[][]) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: "landscape" });
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text(title, 14, 17);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  let y = 29;
  rows.forEach((row, index) => {
    if (y > 190) {
      document.addPage();
      y = 16;
    }
    if (index === 0) document.setFont("helvetica", "bold");
    else document.setFont("helvetica", "normal");
    document.text(row.map(cell => String(cell).slice(0, 34)).join("   |   "), 14, y);
    y += 7;
  });
  document.save(`${fileName}.pdf`);
}
