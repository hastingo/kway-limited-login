import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const trucks = mysqlTable("trucks", {
  id: int("id").autoincrement().primaryKey(),
  registrationNumber: varchar("registrationNumber", { length: 64 }).notNull().unique(),
  model: varchar("model", { length: 160 }).notNull(),
  driverName: varchar("driverName", { length: 160 }).notNull(),
  driverPhone: varchar("driverPhone", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const truckDocuments = mysqlTable("truckDocuments", {
  id: int("id").autoincrement().primaryKey(),
  truckId: int("truckId").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  documentType: varchar("documentType", { length: 120 }).notNull(),
  expiryDate: bigint("expiryDate", { mode: "number" }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 800 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const incomeRecords = mysqlTable("incomeRecords", {
  id: int("id").autoincrement().primaryKey(),
  cargoType: mysqlEnum("cargoType", ["going", "return"]).notNull(),
  tripReference: varchar("tripReference", { length: 80 }).notNull(),
  truckId: int("truckId").notNull().references(() => trucks.id),
  dateOfLoading: bigint("dateOfLoading", { mode: "number" }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  containerNumber: varchar("containerNumber", { length: 100 }).notNull(),
  destination: varchar("destination", { length: 200 }).notNull(),
  incomeAmount: decimal("incomeAmount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "ended"]).default("active").notNull(),
  returnedAt: bigint("returnedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const incomeAttachments = mysqlTable("incomeAttachments", {
  id: int("id").autoincrement().primaryKey(),
  incomeId: int("incomeId").notNull().references(() => incomeRecords.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 800 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  tripReference: varchar("tripReference", { length: 80 }).notNull(),
  truckId: int("truckId").references(() => trucks.id, { onDelete: "set null" }),
  assetType: mysqlEnum("assetType", ["truck", "trailer"]),
  expenseDate: bigint("expenseDate", { mode: "number" }).notNull(),
  expenseType: varchar("expenseType", { length: 120 }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const expenseTypes = mysqlTable("expenseTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const maintenanceRecords = mysqlTable("maintenanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  expenseId: int("expenseId").notNull().unique().references(() => expenses.id, { onDelete: "cascade" }),
  truckId: int("truckId").notNull().references(() => trucks.id),
  assetType: mysqlEnum("assetType", ["truck", "trailer"]).notNull(),
  workshop: varchar("workshop", { length: 200 }),
  odometerKm: int("odometerKm"),
  nextServiceDate: bigint("nextServiceDate", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const expenseAttachments = mysqlTable("expenseAttachments", {
  id: int("id").autoincrement().primaryKey(),
  expenseId: int("expenseId").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 800 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Truck = typeof trucks.$inferSelect;
export type TruckDocument = typeof truckDocuments.$inferSelect;
export type IncomeRecord = typeof incomeRecords.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseType = typeof expenseTypes.$inferSelect;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
