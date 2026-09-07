import { desc, eq } from "drizzle-orm";
import {
  expenseAttachments,
  expenseTypes,
  expenses,
  incomeAttachments,
  incomeRecords,
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

function generateTripReference() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `KW-${date}-${time}`;
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
  const tripReference = input.cargoType === "going" ? generateTripReference() : input.tripReference?.trim();
  if (!tripReference) throw new Error("Return cargo requires an existing trip reference");

  if (input.cargoType === "return") {
    const existing = await db.select({ id: incomeRecords.id }).from(incomeRecords)
      .where(eq(incomeRecords.tripReference, tripReference)).limit(1);
    if (existing.length === 0) throw new Error("Selected trip reference does not exist");
  }

  const [created] = await db.insert(incomeRecords).values({
    cargoType: input.cargoType,
    tripReference,
    truckId: input.truckId,
    dateOfLoading: input.dateOfLoading,
    customerName: input.customerName.trim(),
    containerNumber: input.containerNumber.trim().toUpperCase(),
    destination: input.destination.trim(),
    incomeAmount: input.incomeAmount.toFixed(2),
    description: input.description?.trim() || null,
  }).$returningId();

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

export async function listExpenses() {
  const db = await requireDb();
  const rows = await db.select().from(expenses).orderBy(desc(expenses.expenseDate), desc(expenses.id));
  const attachments = await db.select().from(expenseAttachments).orderBy(desc(expenseAttachments.createdAt));
  const byExpense = new Map<number, (typeof expenseAttachments.$inferSelect)[]>();
  for (const attachment of attachments) {
    const list = byExpense.get(attachment.expenseId) ?? [];
    list.push(attachment);
    byExpense.set(attachment.expenseId, list);
  }
  return rows.map(row => ({ ...row, attachments: byExpense.get(row.id) ?? [] }));
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

async function resolveExpenseTruckId(tripReference: string, explicitTruckId?: number | null) {
  if (explicitTruckId) return explicitTruckId;
  const db = await requireDb();
  const [linked] = await db.select({ truckId: incomeRecords.truckId }).from(incomeRecords)
    .where(eq(incomeRecords.tripReference, tripReference)).limit(1);
  return linked?.truckId ?? null;
}

export async function createExpenses(inputs: Array<{
  tripReference: string;
  truckId?: number | null;
  assetType?: "truck" | "trailer" | null;
  expenseDate: number;
  expenseType: string;
  description: string;
  amount: number;
  attachments: UploadInput[];
}>) {
  const db = await requireDb();
  const createdIds: number[] = [];
  for (const input of inputs) {
    const truckId = await resolveExpenseTruckId(input.tripReference, input.truckId);
    await rememberExpenseType(input.expenseType);
    const [created] = await db.insert(expenses).values({
      tripReference: input.tripReference,
      truckId,
      assetType: input.assetType ?? null,
      expenseDate: input.expenseDate,
      expenseType: input.expenseType.trim(),
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
  truckId?: number | null;
  assetType?: "truck" | "trailer" | null;
  expenseDate: number;
  expenseType: string;
  description: string;
  amount: number;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  const truckId = await resolveExpenseTruckId(input.tripReference, input.truckId);
  await rememberExpenseType(input.expenseType);
  await db.update(expenses).set({
    tripReference: input.tripReference,
    truckId,
    assetType: input.assetType ?? null,
    expenseDate: input.expenseDate,
    expenseType: input.expenseType.trim(),
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
