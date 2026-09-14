import { desc, eq } from "drizzle-orm";
import {
  expenseAttachments,
  expenseTypes,
  expenses,
  incomeAttachments,
  incomeRecords,
  invoiceItems,
  invoices,
  maintenanceRecords,
  truckDocuments,
  trucks,
} from "../drizzle/schema";
import { storagePut } from "./storage";
import { getDb } from "./db";

export type UploadInput = {
  name: string;
  type: string;
  dataUrl: string;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is not available");
  return db;
}

function decodeUpload(file: UploadInput) {
  const match = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`Invalid upload data for ${file.name}`);
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 6 * 1024 * 1024) {
    throw new Error(`${file.name} is larger than the 6 MB limit`);
  }
  return { buffer, contentType: match[1] || file.type || "application/octet-stream" };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160);
}

async function uploadFiles(folder: string, files: UploadInput[]) {
  return Promise.all(
    files.map(async file => {
      const { buffer, contentType } = decodeUpload(file);
      const stored = await storagePut(`kway/${folder}/${safeFileName(file.name)}`, buffer, contentType);
      return {
        fileName: file.name,
        fileKey: stored.key,
        fileUrl: stored.url,
        mimeType: contentType,
      };
    }),
  );
}

export async function listTrucks() {
  const db = await requireDb();
  const rows = await db
    .select({ truck: trucks, document: truckDocuments })
    .from(trucks)
    .leftJoin(truckDocuments, eq(trucks.id, truckDocuments.truckId))
    .orderBy(desc(trucks.createdAt), desc(truckDocuments.createdAt));

  const grouped = new Map<number, typeof trucks.$inferSelect & { documents: (typeof truckDocuments.$inferSelect)[] }>();
  for (const row of rows) {
    if (!grouped.has(row.truck.id)) grouped.set(row.truck.id, { ...row.truck, documents: [] });
    if (row.document) grouped.get(row.truck.id)?.documents.push(row.document);
  }
  return Array.from(grouped.values());
}

export async function createTruck(input: {
  registrationNumber: string;
  model: string;
  driverName: string;
  driverPhone: string;
}) {
  const db = await requireDb();
  const [created] = await db.insert(trucks).values({
    registrationNumber: input.registrationNumber.trim().toUpperCase(),
    model: input.model.trim(),
    driverName: input.driverName.trim(),
    driverPhone: input.driverPhone.trim(),
  }).$returningId();
  return created;
}

export async function updateTruck(input: {
  id: number;
  registrationNumber: string;
  model: string;
  driverName: string;
  driverPhone: string;
}) {
  const db = await requireDb();
  await db.update(trucks).set({
    registrationNumber: input.registrationNumber.trim().toUpperCase(),
    model: input.model.trim(),
    driverName: input.driverName.trim(),
    driverPhone: input.driverPhone.trim(),
  }).where(eq(trucks.id, input.id));
  return { success: true as const };
}

export async function addTruckDocument(input: {
  truckId: number;
  documentType: string;
  expiryDate: number;
  file: UploadInput;
}) {
  const db = await requireDb();
  const [uploaded] = await uploadFiles(`truck-${input.truckId}/documents`, [input.file]);
  const [created] = await db.insert(truckDocuments).values({
    truckId: input.truckId,
    documentType: input.documentType,
    expiryDate: input.expiryDate,
    ...uploaded,
  }).$returningId();
  return created;
}

export async function deleteTruckDocument(id: number) {
  const db = await requireDb();
  await db.delete(truckDocuments).where(eq(truckDocuments.id, id));
  return { success: true as const };
}

export async function listIncome() {
  const db = await requireDb();
  const rows = await db
    .select({ income: incomeRecords, truck: trucks })
    .from(incomeRecords)
    .innerJoin(trucks, eq(incomeRecords.truckId, trucks.id))
    .orderBy(desc(incomeRecords.dateOfLoading), desc(incomeRecords.id));
  const attachments = await db.select().from(incomeAttachments).orderBy(desc(incomeAttachments.createdAt));
  const byIncome = new Map<number, (typeof incomeAttachments.$inferSelect)[]>();
  for (const attachment of attachments) {
    const list = byIncome.get(attachment.incomeId) ?? [];
    list.push(attachment);
    byIncome.set(attachment.incomeId, list);
  }
  return rows.map(row => ({ ...row.income, truck: row.truck, attachments: byIncome.get(row.income.id) ?? [] }));
}

export function formatTripReference(incomeId: number) {
  return `TRIP-${String(incomeId).padStart(4, "0")}`;
}

export async function createIncome(input: {
  cargoType: "going" | "return";
  tripReference?: string;
  truckId: number;
  dateOfLoading: number;
  customerName: string;
  containerNumber: string;
  destination: string;
  incomeAmount: number;
  description?: string;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  const selectedReference = input.tripReference?.trim();
  if (input.cargoType === "return" && !selectedReference) {
    throw new Error("Return cargo requires an existing trip reference");
  }

  let truckId = input.truckId;
  if (input.cargoType === "return") {
    const existing = await db.select({ id: incomeRecords.id, truckId: incomeRecords.truckId }).from(incomeRecords)
      .where(eq(incomeRecords.tripReference, selectedReference!)).limit(1);
    if (existing.length === 0) throw new Error("Selected trip reference does not exist");
    truckId = existing[0].truckId;
  }

  const [created] = await db.insert(incomeRecords).values({
    cargoType: input.cargoType,
    tripReference: input.cargoType === "going" ? "TRIP-PENDING" : selectedReference!,
    truckId,
    dateOfLoading: input.dateOfLoading,
    customerName: input.customerName.trim(),
    containerNumber: input.containerNumber.trim().toUpperCase(),
    destination: input.destination.trim(),
    incomeAmount: input.incomeAmount.toFixed(2),
    description: input.description?.trim() || null,
  }).$returningId();

  const tripReference = input.cargoType === "going"
    ? formatTripReference(created.id)
    : selectedReference!;
  if (input.cargoType === "going") {
    await db.update(incomeRecords).set({ tripReference }).where(eq(incomeRecords.id, created.id));
  }

  if (input.attachments.length) {
    const uploaded = await uploadFiles(`income-${created.id}`, input.attachments);
    await db.insert(incomeAttachments).values(uploaded.map(file => ({ incomeId: created.id, ...file })));
  }
  return { id: created.id, tripReference };
}

export async function setTripStatus(tripReference: string, status: "active" | "ended", returnedAt?: number) {
  const db = await requireDb();
  await db.update(incomeRecords).set({
    status,
    returnedAt: status === "ended" ? returnedAt ?? Date.now() : null,
  }).where(eq(incomeRecords.tripReference, tripReference));
  return { success: true as const };
}

export async function listTripTrackingTargets() {
  const db = await requireDb();
  const rows = await db
    .select({ income: incomeRecords, truck: trucks })
    .from(incomeRecords)
    .innerJoin(trucks, eq(incomeRecords.truckId, trucks.id))
    .orderBy(incomeRecords.dateOfLoading, incomeRecords.id);

  const grouped = new Map<string, {
    tripReference: string;
    registrationNumber: string;
    dateOfLoading: number;
    returnedAt: number | null;
    status: "active" | "ended";
  }>();
  for (const row of rows) {
    const existing = grouped.get(row.income.tripReference);
    if (!existing) {
      grouped.set(row.income.tripReference, {
        tripReference: row.income.tripReference,
        registrationNumber: row.truck.registrationNumber,
        dateOfLoading: row.income.dateOfLoading,
        returnedAt: row.income.returnedAt,
        status: row.income.status,
      });
      continue;
    }
    existing.dateOfLoading = Math.min(existing.dateOfLoading, row.income.dateOfLoading);
    if (row.income.returnedAt) {
      existing.returnedAt = Math.max(existing.returnedAt ?? 0, row.income.returnedAt);
    }
    if (row.income.status === "active") existing.status = "active";
  }
  return Array.from(grouped.values());
}

export async function updateTripTrackingDistance(
  tripReference: string,
  distanceKm: number,
  trackingSyncedAt: number,
) {
  const db = await requireDb();
  await db.update(incomeRecords).set({
    trackedDistanceKm: distanceKm.toFixed(2),
    trackingSyncedAt,
  }).where(eq(incomeRecords.tripReference, tripReference));
  return { success: true as const };
}

export async function deleteTrip(tripReference: string) {
  const db = await requireDb();
  const existing = await db.select({ id: incomeRecords.id }).from(incomeRecords)
    .where(eq(incomeRecords.tripReference, tripReference)).limit(1);
  if (existing.length === 0) throw new Error("Trip reference was not found");

  await db.transaction(async transaction => {
    await transaction.delete(expenses).where(eq(expenses.tripReference, tripReference));
    await transaction.delete(incomeRecords).where(eq(incomeRecords.tripReference, tripReference));
  });
  return { success: true as const };
}

export async function listExpenses() {
  const db = await requireDb();
  const rows = await db
    .select({ expense: expenses, truck: trucks })
    .from(expenses)
    .leftJoin(trucks, eq(expenses.truckId, trucks.id))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id));
  const attachments = await db.select().from(expenseAttachments).orderBy(desc(expenseAttachments.createdAt));
  const byExpense = new Map<number, (typeof expenseAttachments.$inferSelect)[]>();
  for (const attachment of attachments) {
    const list = byExpense.get(attachment.expenseId) ?? [];
    list.push(attachment);
    byExpense.set(attachment.expenseId, list);
  }
  return rows.map(row => ({
    ...row.expense,
    truck: row.truck,
    attachments: byExpense.get(row.expense.id) ?? [],
  }));
}

export async function listExpenseTypes() {
  const db = await requireDb();
  return db.select().from(expenseTypes).orderBy(expenseTypes.name);
}

async function rememberExpenseType(name: string) {
  const db = await requireDb();
  const normalized = name.trim();
  await db.insert(expenseTypes).values({ name: normalized }).onDuplicateKeyUpdate({
    set: { name: normalized },
  });
}

export async function resolveExpenseTruckId(tripReference: string) {
  const db = await requireDb();
  const [linked] = await db.select({ truckId: incomeRecords.truckId }).from(incomeRecords)
    .where(eq(incomeRecords.tripReference, tripReference)).limit(1);
  return linked?.truckId ?? null;
}

export async function createExpenses(inputs: Array<{
  tripReference: string;
  assetType?: "truck" | "trailer" | null;
  expenseDate: number;
  expenseType: string;
  fuelLiters?: number | null;
  description: string;
  amount: number;
  attachments: UploadInput[];
}>) {
  const db = await requireDb();
  const createdIds: number[] = [];
  for (const input of inputs) {
    const truckId = await resolveExpenseTruckId(input.tripReference);
    if (!truckId) {
      throw new Error(`No truck is assigned to ${input.tripReference}`);
    }
    await rememberExpenseType(input.expenseType);
    const [created] = await db.insert(expenses).values({
      tripReference: input.tripReference,
      truckId,
      assetType: input.assetType ?? null,
      expenseDate: input.expenseDate,
      expenseType: input.expenseType.trim(),
      fuelLiters: input.expenseType.trim().toLowerCase() === "fuel" && input.fuelLiters
        ? input.fuelLiters.toFixed(2)
        : null,
      description: input.description.trim(),
      amount: input.amount.toFixed(2),
    }).$returningId();
    createdIds.push(created.id);
    if (input.attachments.length) {
      const uploaded = await uploadFiles(`expense-${created.id}`, input.attachments);
      await db.insert(expenseAttachments).values(uploaded.map(file => ({ expenseId: created.id, ...file })));
    }
  }
  return { ids: createdIds };
}

export async function updateExpense(input: {
  id: number;
  tripReference: string;
  assetType?: "truck" | "trailer" | null;
  expenseDate: number;
  expenseType: string;
  fuelLiters?: number | null;
  description: string;
  amount: number;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  const truckId = await resolveExpenseTruckId(input.tripReference);
  if (!truckId) {
    throw new Error(`No truck is assigned to ${input.tripReference}`);
  }
  await rememberExpenseType(input.expenseType);
  await db.update(expenses).set({
    tripReference: input.tripReference,
    truckId,
    assetType: input.assetType ?? null,
    expenseDate: input.expenseDate,
    expenseType: input.expenseType.trim(),
    fuelLiters: input.expenseType.trim().toLowerCase() === "fuel" && input.fuelLiters
      ? input.fuelLiters.toFixed(2)
      : null,
    description: input.description.trim(),
    amount: input.amount.toFixed(2),
  }).where(eq(expenses.id, input.id));
  if (input.attachments.length) {
    const uploaded = await uploadFiles(`expense-${input.id}`, input.attachments);
    await db.insert(expenseAttachments).values(uploaded.map(file => ({ expenseId: input.id, ...file })));
  }
  return { success: true as const };
}

export async function deleteExpense(id: number) {
  const db = await requireDb();
  await db.delete(expenses).where(eq(expenses.id, id));
  return { success: true as const };
}

export async function listMaintenance() {
  const db = await requireDb();
  const rows = await db
    .select({ maintenance: maintenanceRecords, expense: expenses, truck: trucks })
    .from(maintenanceRecords)
    .innerJoin(expenses, eq(maintenanceRecords.expenseId, expenses.id))
    .innerJoin(trucks, eq(maintenanceRecords.truckId, trucks.id))
    .orderBy(desc(expenses.expenseDate), desc(maintenanceRecords.id));
  const attachments = await db.select().from(expenseAttachments).orderBy(desc(expenseAttachments.createdAt));
  const byExpense = new Map<number, (typeof expenseAttachments.$inferSelect)[]>();
  for (const attachment of attachments) {
    const list = byExpense.get(attachment.expenseId) ?? [];
    list.push(attachment);
    byExpense.set(attachment.expenseId, list);
  }
  return rows.map(row => ({
    ...row.maintenance,
    expense: { ...row.expense, attachments: byExpense.get(row.expense.id) ?? [] },
    truck: row.truck,
  }));
}

export async function createMaintenance(input: {
  truckId: number;
  assetType: "truck" | "trailer";
  serviceDate: number;
  maintenanceType: string;
  description: string;
  amount: number;
  workshop?: string;
  odometerKm?: number;
  nextServiceDate?: number;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  await rememberExpenseType(input.maintenanceType);
  const [expense] = await db.insert(expenses).values({
    tripReference: "MAINTENANCE",
    truckId: input.truckId,
    assetType: input.assetType,
    expenseDate: input.serviceDate,
    expenseType: input.maintenanceType.trim(),
    description: input.description.trim(),
    amount: input.amount.toFixed(2),
  }).$returningId();
  const [maintenance] = await db.insert(maintenanceRecords).values({
    expenseId: expense.id,
    truckId: input.truckId,
    assetType: input.assetType,
    workshop: input.workshop?.trim() || null,
    odometerKm: input.odometerKm ?? null,
    nextServiceDate: input.nextServiceDate ?? null,
  }).$returningId();
  if (input.attachments.length) {
    const uploaded = await uploadFiles(`maintenance-${maintenance.id}`, input.attachments);
    await db.insert(expenseAttachments).values(uploaded.map(file => ({ expenseId: expense.id, ...file })));
  }
  return { id: maintenance.id, expenseId: expense.id };
}

export async function updateMaintenance(input: {
  id: number;
  expenseId: number;
  truckId: number;
  assetType: "truck" | "trailer";
  serviceDate: number;
  maintenanceType: string;
  description: string;
  amount: number;
  workshop?: string;
  odometerKm?: number;
  nextServiceDate?: number;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  await rememberExpenseType(input.maintenanceType);
  await db.update(expenses).set({
    truckId: input.truckId,
    assetType: input.assetType,
    expenseDate: input.serviceDate,
    expenseType: input.maintenanceType.trim(),
    description: input.description.trim(),
    amount: input.amount.toFixed(2),
  }).where(eq(expenses.id, input.expenseId));
  await db.update(maintenanceRecords).set({
    truckId: input.truckId,
    assetType: input.assetType,
    workshop: input.workshop?.trim() || null,
    odometerKm: input.odometerKm ?? null,
    nextServiceDate: input.nextServiceDate ?? null,
  }).where(eq(maintenanceRecords.id, input.id));
  if (input.attachments.length) {
    const uploaded = await uploadFiles(`maintenance-${input.id}`, input.attachments);
    await db.insert(expenseAttachments).values(uploaded.map(file => ({ expenseId: input.expenseId, ...file })));
  }
  return { success: true as const };
}

export async function deleteMaintenance(expenseId: number) {
  return deleteExpense(expenseId);
}

export function formatInvoiceNumber(invoiceId: number, invoiceDate = Date.now()) {
  const year = new Date(invoiceDate).getUTCFullYear();
  return `KWL-INV-${year}-${String(invoiceId).padStart(4, "0")}`;
}

export function calculateInvoiceLineTotal(numberOfTrucks: number, unitPrice: number) {
  return Number((numberOfTrucks * unitPrice).toFixed(2));
}

export async function listInvoices() {
  const db = await requireDb();
  const rows = await db
    .select({ invoice: invoices, item: invoiceItems })
    .from(invoices)
    .leftJoin(invoiceItems, eq(invoices.id, invoiceItems.invoiceId))
    .orderBy(desc(invoices.invoiceDate), desc(invoices.id), invoiceItems.id);
  const grouped = new Map<number, typeof invoices.$inferSelect & {
    items: (typeof invoiceItems.$inferSelect)[];
    totalAmount: number;
  }>();
  for (const row of rows) {
    if (!grouped.has(row.invoice.id)) {
      grouped.set(row.invoice.id, { ...row.invoice, items: [], totalAmount: 0 });
    }
    if (row.item) {
      const current = grouped.get(row.invoice.id)!;
      current.items.push(row.item);
      current.totalAmount += Number(row.item.totalPrice);
    }
  }
  return Array.from(grouped.values());
}

export async function createInvoice(input: {
  customerName: string;
  customerTin: string;
  customerVrn: string;
  containerNumber?: string;
  bankDetails: string;
  notes?: string;
  items: Array<{
    description: string;
    numberOfTrucks: number;
    unitPrice: number;
  }>;
}) {
  const db = await requireDb();
  const invoiceDate = Date.now();
  return db.transaction(async transaction => {
    const pendingNumber = `PENDING-${invoiceDate}-${Math.random().toString(36).slice(2, 10)}`;
    const [created] = await transaction.insert(invoices).values({
      invoiceNumber: pendingNumber,
      invoiceDate,
      customerName: input.customerName.trim(),
      customerTin: input.customerTin.trim(),
      customerVrn: input.customerVrn.trim(),
      containerNumber: input.containerNumber?.trim().toUpperCase() || null,
      currency: "USD",
      bankDetails: input.bankDetails.trim(),
      notes: input.notes?.trim() || null,
    }).$returningId();
    const invoiceNumber = formatInvoiceNumber(created.id, invoiceDate);
    await transaction.update(invoices).set({ invoiceNumber }).where(eq(invoices.id, created.id));
    await transaction.insert(invoiceItems).values(input.items.map(item => ({
      invoiceId: created.id,
      description: item.description.trim(),
      numberOfTrucks: item.numberOfTrucks,
      unitPrice: item.unitPrice.toFixed(2),
      totalPrice: calculateInvoiceLineTotal(item.numberOfTrucks, item.unitPrice).toFixed(2),
    })));
    return { id: created.id, invoiceNumber, invoiceDate };
  });
}

export async function deleteInvoice(id: number) {
  const db = await requireDb();
  await db.delete(invoices).where(eq(invoices.id, id));
  return { success: true as const };
}
