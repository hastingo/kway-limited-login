import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, BACKUP_VERSION, validateBackupEnvelope } from "./portalBackup";

const emptyBackup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: "2026-09-07T00:00:00.000Z",
  data: {
    trucks: [],
    truckDocuments: [],
    incomeRecords: [],
    incomeAttachments: [],
    expenses: [],
    expenseAttachments: [],
    expenseTypes: [],
    maintenanceRecords: [],
  },
};

describe("validateBackupEnvelope", () => {
  it("accepts the current K-Way backup format", () => {
    expect(validateBackupEnvelope(emptyBackup)).toEqual(emptyBackup);
  });

  it("rejects unrelated JSON files", () => {
    expect(() => validateBackupEnvelope({ data: {} })).toThrow("not a K-Way transport backup");
  });

  it("rejects unsupported backup versions", () => {
    expect(() => validateBackupEnvelope({ ...emptyBackup, version: 99 })).toThrow("not supported");
  });
});
