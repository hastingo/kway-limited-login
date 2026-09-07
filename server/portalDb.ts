import { desc, eq } from "drizzle-orm";
import {
  expenseAttachments,
  expenses,
  incomeAttachments,
  incomeRecords,
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

export async function createExpenses(inputs: Array<{
  tripReference: string;
  expenseDate: number;
  expenseType: string;
  description: string;
  amount: number;
  attachments: UploadInput[];
}>) {
  const db = await requireDb();
  const createdIds: number[] = [];
  for (const input of inputs) {
    const [created] = await db.insert(expenses).values({
      tripReference: input.tripReference,
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
  expenseDate: number;
  expenseType: string;
  description: string;
  amount: number;
  attachments: UploadInput[];
}) {
  const db = await requireDb();
  await db.update(expenses).set({
    tripReference: input.tripReference,
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
