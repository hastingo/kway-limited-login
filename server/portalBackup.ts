import { and, eq } from "drizzle-orm";
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
import { getDb } from "./db";

export const BACKUP_FORMAT = "kway-transport-backup";
export const BACKUP_VERSION = 1;

export type PortalBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    trucks: (typeof trucks.$inferSelect)[];
    truckDocuments: (typeof truckDocuments.$inferSelect)[];
    incomeRecords: (typeof incomeRecords.$inferSelect)[];
    incomeAttachments: (typeof incomeAttachments.$inferSelect)[];
    expenses: (typeof expenses.$inferSelect)[];
    expenseAttachments: (typeof expenseAttachments.$inferSelect)[];
    expenseTypes: (typeof expenseTypes.$inferSelect)[];
    maintenanceRecords: (typeof maintenanceRecords.$inferSelect)[];
  };
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is not available");
  return db;
}

function numericTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const converted = new Date(String(value)).getTime();
  return Number.isFinite(converted) ? converted : null;
}

function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required in the backup`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === "object") as Record<string, unknown>[];
}

export function validateBackupEnvelope(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Backup file must contain a JSON object");
  const backup = input as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT) throw new Error("This is not a K-Way transport backup file");
  if (backup.version !== BACKUP_VERSION) throw new Error("This backup version is not supported");
  if (!backup.data || typeof backup.data !== "object") throw new Error("Backup data section is missing");
  return backup as unknown as PortalBackup;
}

export async function createPortalBackup(): Promise<PortalBackup> {
  const db = await requireDb();
  const [truckRows, documentRows, incomeRows, incomeFileRows, expenseRows, expenseFileRows, typeRows, maintenanceRows] = await Promise.all([
    db.select().from(trucks),
    db.select().from(truckDocuments),
    db.select().from(incomeRecords),
    db.select().from(incomeAttachments),
    db.select().from(expenses),
    db.select().from(expenseAttachments),
    db.select().from(expenseTypes),
    db.select().from(maintenanceRecords),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trucks: truckRows,
      truckDocuments: documentRows,
      incomeRecords: incomeRows,
      incomeAttachments: incomeFileRows,
      expenses: expenseRows,
      expenseAttachments: expenseFileRows,
      expenseTypes: typeRows,
      maintenanceRecords: maintenanceRows,
    },
  };
}

export async function importPortalBackup(input: unknown) {
  const backup = validateBackupEnvelope(input);
  const db = await requireDb();
  const data = backup.data as unknown as Record<string, unknown>;
  const counts = { trucks: 0, documents: 0, income: 0, expenses: 0, maintenance: 0, attachments: 0, expenseTypes: 0 };

  await db.transaction(async transaction => {
    const truckIdMap = new Map<number, number>();
    for (const source of records(data.trucks)) {
      const registrationNumber = requiredText(source.registrationNumber, "Truck registration").toUpperCase();
      const existing = await transaction.select({ id: trucks.id }).from(trucks)
        .where(eq(trucks.registrationNumber, registrationNumber)).limit(1);
      let truckId = existing[0]?.id;
      if (!truckId) {
        const [created] = await transaction.insert(trucks).values({
          registrationNumber,
          model: requiredText(source.model, "Truck model"),
          driverName: requiredText(source.driverName, "Driver name"),
          driverPhone: requiredText(source.driverPhone, "Driver phone"),
        }).$returningId();
        truckId = created.id;
        counts.trucks += 1;
      }
      truckIdMap.set(Number(source.id), truckId);
    }

    for (const source of records(data.expenseTypes)) {
      const name = requiredText(source.name, "Expense type");
      const existing = await transaction.select({ id: expenseTypes.id }).from(expenseTypes)
        .where(eq(expenseTypes.name, name)).limit(1);
      if (!existing.length) {
        await transaction.insert(expenseTypes).values({ name });
        counts.expenseTypes += 1;
      }
    }

    for (const source of records(data.truckDocuments)) {
      const truckId = truckIdMap.get(Number(source.truckId));
      if (!truckId) continue;
      const fileKey = requiredText(source.fileKey, "Truck document file key");
      const existing = await transaction.select({ id: truckDocuments.id }).from(truckDocuments)
        .where(eq(truckDocuments.fileKey, fileKey)).limit(1);
      if (!existing.length) {
        await transaction.insert(truckDocuments).values({
          truckId,
          documentType: requiredText(source.documentType, "Document type"),
          expiryDate: numericTimestamp(source.expiryDate) ?? Date.now(),
          fileName: requiredText(source.fileName, "Document filename"),
          fileKey,
          fileUrl: requiredText(source.fileUrl, "Document URL"),
          mimeType: requiredText(source.mimeType, "Document MIME type"),
        });
        counts.documents += 1;
      }
    }

    const incomeIdMap = new Map<number, number>();
    for (const source of records(data.incomeRecords)) {
      const truckId = truckIdMap.get(Number(source.truckId));
      if (!truckId) continue;
      const tripReference = requiredText(source.tripReference, "Trip reference");
      const cargoType = source.cargoType === "return" ? "return" : "going";
      const containerNumber = requiredText(source.containerNumber, "Container number").toUpperCase();
      const existing = await transaction.select().from(incomeRecords)
        .where(and(
          eq(incomeRecords.tripReference, tripReference),
          eq(incomeRecords.cargoType, cargoType),
          eq(incomeRecords.containerNumber, containerNumber),
        ));
      let incomeId: number | undefined;
      incomeId = existing.find(item => item.dateOfLoading === numericTimestamp(source.dateOfLoading))?.id;
      if (!incomeId) {
        const [created] = await transaction.insert(incomeRecords).values({
          cargoType,
          tripReference,
          truckId,
          dateOfLoading: numericTimestamp(source.dateOfLoading) ?? Date.now(),
          customerName: requiredText(source.customerName, "Customer name"),
          containerNumber,
          destination: requiredText(source.destination, "Destination"),
          incomeAmount: Number(source.incomeAmount ?? 0).toFixed(2),
          description: optionalText(source.description),
          status: source.status === "ended" ? "ended" : "active",
          returnedAt: numericTimestamp(source.returnedAt),
          trackedDistanceKm: source.trackedDistanceKm ? Number(source.trackedDistanceKm).toFixed(2) : null,
          trackingSyncedAt: numericTimestamp(source.trackingSyncedAt),
        }).$returningId();
        incomeId = created.id;
        counts.income += 1;
      }
      incomeIdMap.set(Number(source.id), incomeId);
    }

    for (const source of records(data.incomeAttachments)) {
      const incomeId = incomeIdMap.get(Number(source.incomeId));
      if (!incomeId) continue;
      const fileKey = requiredText(source.fileKey, "Income attachment file key");
      const existing = await transaction.select({ id: incomeAttachments.id }).from(incomeAttachments)
        .where(eq(incomeAttachments.fileKey, fileKey)).limit(1);
      if (!existing.length) {
        await transaction.insert(incomeAttachments).values({
          incomeId,
          fileName: requiredText(source.fileName, "Income attachment filename"),
          fileKey,
          fileUrl: requiredText(source.fileUrl, "Income attachment URL"),
          mimeType: requiredText(source.mimeType, "Income attachment MIME type"),
        });
        counts.attachments += 1;
      }
    }

    const expenseIdMap = new Map<number, number>();
    for (const source of records(data.expenses)) {
      const mappedTruckId = source.truckId ? truckIdMap.get(Number(source.truckId)) ?? null : null;
      const tripReference = requiredText(source.tripReference, "Expense trip reference");
      const description = requiredText(source.description, "Expense description");
      const expenseDate = numericTimestamp(source.expenseDate) ?? Date.now();
      const existing = await transaction.select({ id: expenses.id }).from(expenses)
        .where(eq(expenses.tripReference, tripReference));
      let expenseId: number | undefined;
      if (existing.length) {
        const candidates = await transaction.select().from(expenses).where(eq(expenses.tripReference, tripReference));
        expenseId = candidates.find(item => item.expenseDate === expenseDate && item.description === description && Number(item.amount) === Number(source.amount))?.id;
      }
      if (!expenseId) {
        const [created] = await transaction.insert(expenses).values({
          tripReference,
          truckId: mappedTruckId,
          assetType: source.assetType === "trailer" ? "trailer" : source.assetType === "truck" ? "truck" : null,
          expenseDate,
          expenseType: requiredText(source.expenseType, "Expense type"),
          fuelLiters: source.fuelLiters ? Number(source.fuelLiters).toFixed(2) : null,
          description,
          amount: Number(source.amount ?? 0).toFixed(2),
        }).$returningId();
        expenseId = created.id;
        counts.expenses += 1;
      }
      expenseIdMap.set(Number(source.id), expenseId);
    }

    for (const source of records(data.expenseAttachments)) {
      const expenseId = expenseIdMap.get(Number(source.expenseId));
      if (!expenseId) continue;
      const fileKey = requiredText(source.fileKey, "Expense attachment file key");
      const existing = await transaction.select({ id: expenseAttachments.id }).from(expenseAttachments)
        .where(eq(expenseAttachments.fileKey, fileKey)).limit(1);
      if (!existing.length) {
        await transaction.insert(expenseAttachments).values({
          expenseId,
          fileName: requiredText(source.fileName, "Expense attachment filename"),
          fileKey,
          fileUrl: requiredText(source.fileUrl, "Expense attachment URL"),
          mimeType: requiredText(source.mimeType, "Expense attachment MIME type"),
        });
        counts.attachments += 1;
      }
    }

    for (const source of records(data.maintenanceRecords)) {
      const expenseId = expenseIdMap.get(Number(source.expenseId));
      const truckId = truckIdMap.get(Number(source.truckId));
      if (!expenseId || !truckId) continue;
      const existing = await transaction.select({ id: maintenanceRecords.id }).from(maintenanceRecords)
        .where(eq(maintenanceRecords.expenseId, expenseId)).limit(1);
      if (!existing.length) {
        await transaction.insert(maintenanceRecords).values({
          expenseId,
          truckId,
          assetType: source.assetType === "trailer" ? "trailer" : "truck",
          workshop: optionalText(source.workshop),
          odometerKm: source.odometerKm ? Number(source.odometerKm) : null,
          nextServiceDate: numericTimestamp(source.nextServiceDate),
        });
        counts.maintenance += 1;
      }
    }
  });

  return { success: true as const, counts };
}
