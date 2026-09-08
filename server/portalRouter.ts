import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  clearPortalSessionCookie,
  createPortalSession,
  portalLoginInput,
  portalProcedure,
  readPortalSession,
  setPortalSessionCookie,
  validateTemporaryCredentials,
} from "./portalAuth";
import { createPortalBackup, importPortalBackup } from "./portalBackup";
import {
  addTruckDocument,
  createExpenses,
  createIncome,
  createMaintenance,
  createTruck,
  deleteExpense,
  deleteMaintenance,
  deleteTrip,
  deleteTruckDocument,
  listExpenses,
  listExpenseTypes,
  listIncome,
  listMaintenance,
  listTrucks,
  setTripStatus,
  updateExpense,
  updateMaintenance,
  updateTruck,
} from "./portalDb";

const uploadSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(120),
  dataUrl: z.string().min(1).max(8_500_000),
});

const truckInput = z.object({
  registrationNumber: z.string().min(2).max(64),
  model: z.string().min(2).max(160),
  driverName: z.string().min(2).max(160),
  driverPhone: z.string().min(7).max(64),
});

export const expenseInput = z.object({
  tripReference: z.string().min(1).max(80),
  truckId: z.number().int().positive().nullable().optional(),
  assetType: z.enum(["truck", "trailer"]).nullable().optional(),
  expenseDate: z.number().int().positive(),
  expenseType: z.string().min(2).max(120),
  fuelLiters: z.number().positive().nullable().optional(),
  description: z.string().min(2).max(2000),
  amount: z.number().positive(),
  attachments: z.array(uploadSchema).max(5).default([]),
}).superRefine((input, context) => {
  if (input.expenseType.trim().toLowerCase() === "fuel" && !input.fuelLiters) {
    context.addIssue({
      code: "custom",
      path: ["fuelLiters"],
      message: "Fuel volume in liters is required for fuel expenses",
    });
  }
});

const maintenanceInput = z.object({
  truckId: z.number().int().positive(),
  assetType: z.enum(["truck", "trailer"]),
  serviceDate: z.number().int().positive(),
  maintenanceType: z.string().min(2).max(120),
  description: z.string().min(2).max(2000),
  amount: z.number().positive(),
  workshop: z.string().max(200).optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  nextServiceDate: z.number().int().positive().optional(),
  attachments: z.array(uploadSchema).max(5).default([]),
});

export const portalRouter = router({
  auth: router({
    status: publicProcedure.query(({ ctx }) => readPortalSession(ctx.req)),
    login: publicProcedure.input(portalLoginInput).mutation(({ ctx, input }) => {
      if (!validateTemporaryCredentials(input.email, input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or temporary password" });
      }
      const { token, expiresAt } = createPortalSession(input.email, input.rememberMe);
      setPortalSessionCookie(ctx.req, ctx.res, token, expiresAt);
      return { email: input.email.toLowerCase(), name: "Sales Operations", expiresAt };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearPortalSessionCookie(ctx.req, ctx.res);
      return { success: true as const };
    }),
  }),

  trucks: router({
    list: portalProcedure.query(() => listTrucks()),
    create: portalProcedure.input(truckInput).mutation(({ input }) => createTruck(input)),
    update: portalProcedure.input(truckInput.extend({ id: z.number().int().positive() })).mutation(({ input }) => updateTruck(input)),
    addDocument: portalProcedure.input(z.object({
      truckId: z.number().int().positive(),
      documentType: z.string().min(2).max(120),
      expiryDate: z.number().int().positive(),
      file: uploadSchema,
    })).mutation(({ input }) => addTruckDocument(input)),
    deleteDocument: portalProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteTruckDocument(input.id)),
  }),

  income: router({
    list: portalProcedure.query(() => listIncome()),
    create: portalProcedure.input(z.object({
      cargoType: z.enum(["going", "return"]),
      tripReference: z.string().max(80).optional(),
      truckId: z.number().int().positive(),
      dateOfLoading: z.number().int().positive(),
      customerName: z.string().min(2).max(200),
      containerNumber: z.string().min(2).max(100),
      destination: z.string().min(2).max(200),
      incomeAmount: z.number().positive(),
      description: z.string().max(2000).optional(),
      attachments: z.array(uploadSchema).max(5).default([]),
    })).mutation(({ input }) => createIncome(input)),
    setStatus: portalProcedure.input(z.object({
      tripReference: z.string().min(1).max(80),
      status: z.enum(["active", "ended"]),
      returnedAt: z.number().int().positive().optional(),
    })).mutation(({ input }) => setTripStatus(input.tripReference, input.status, input.returnedAt)),
    deleteTrip: portalProcedure.input(z.object({ tripReference: z.string().min(1).max(80) }))
      .mutation(({ input }) => deleteTrip(input.tripReference)),
  }),

  expenses: router({
    list: portalProcedure.query(() => listExpenses()),
    types: portalProcedure.query(() => listExpenseTypes()),
    createMany: portalProcedure.input(z.object({ records: z.array(expenseInput).min(1).max(10) }))
      .mutation(({ input }) => createExpenses(input.records)),
    update: portalProcedure.input(expenseInput.safeExtend({ id: z.number().int().positive() }))
      .mutation(({ input }) => updateExpense(input)),
    delete: portalProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteExpense(input.id)),
  }),

  maintenance: router({
    list: portalProcedure.query(() => listMaintenance()),
    create: portalProcedure.input(maintenanceInput)
      .mutation(({ input }) => createMaintenance(input)),
    update: portalProcedure.input(maintenanceInput.extend({
      id: z.number().int().positive(),
      expenseId: z.number().int().positive(),
    })).mutation(({ input }) => updateMaintenance(input)),
    delete: portalProcedure.input(z.object({ expenseId: z.number().int().positive() }))
      .mutation(({ input }) => deleteMaintenance(input.expenseId)),
  }),

  data: router({
    sync: portalProcedure.query(async () => {
      const backup = await createPortalBackup();
      return {
        syncedAt: backup.exportedAt,
        counts: {
          trucks: backup.data.trucks.length,
          trips: backup.data.incomeRecords.length,
          expenses: backup.data.expenses.length,
          maintenance: backup.data.maintenanceRecords.length,
        },
      };
    }),
    backup: portalProcedure.query(() => createPortalBackup()),
    import: portalProcedure.input(z.object({ backup: z.unknown() }))
      .mutation(({ input }) => importPortalBackup(input.backup)),
  }),
});
