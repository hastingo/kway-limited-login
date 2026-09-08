import { trpc } from "@/lib/trpc";
import { DatabaseBackup, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function DataControls() {
  const utils = trpc.useUtils();
  const importInput = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const syncQuery = trpc.portal.data.sync.useQuery(undefined, { enabled: false, retry: false });
  const backupQuery = trpc.portal.data.backup.useQuery(undefined, { enabled: false, retry: false });

  const invalidatePortal = async () => {
    await Promise.all([
      utils.portal.trucks.list.invalidate(),
      utils.portal.income.list.invalidate(),
      utils.portal.expenses.list.invalidate(),
      utils.portal.expenses.types.invalidate(),
      utils.portal.maintenance.list.invalidate(),
    ]);
  };

  const importBackup = trpc.portal.data.import.useMutation({
    onSuccess: async result => {
      await invalidatePortal();
      const imported = Object.values(result.counts).reduce((sum, value) => sum + value, 0);
      toast.success("Data import complete", {
        description: imported
          ? `${imported} new record${imported === 1 ? "" : "s"} merged into the portal.`
          : "No new records were found; existing data was kept unchanged.",
      });
    },
    onError: error => toast.error("Import failed", { description: error.message }),
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await invalidatePortal();
      const result = await syncQuery.refetch();
      if (result.error) throw result.error;
      const counts = result.data?.counts;
      toast.success("Data synchronized", {
        description: counts
          ? `${counts.trucks} trucks · ${counts.trips} cargo records · ${counts.expenses} expenses`
          : "The latest portal data is now displayed.",
      });
    } catch (error) {
      toast.error("Could not synchronize data", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSyncing(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const result = await backupQuery.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No backup data was returned");
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `kway-transport-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded", { description: "Keep the JSON file in a secure location." });
    } catch (error) {
      toast.error("Could not create backup", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBackingUp(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Choose a K-Way JSON backup file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Backup file is larger than the 10 MB import limit");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      importBackup.mutate({ backup: parsed });
    } catch {
      toast.error("The selected file is not valid JSON");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const buttonClass = "inline-flex h-9 items-center gap-2 rounded-xl border border-[#dfe4e2] bg-white px-2.5 text-[10px] font-extrabold text-[#425466] shadow-sm transition-all hover:border-[#f0b487] hover:text-[#c9580e] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60";

  return (
    <div className="flex items-center gap-1.5" aria-label="Data management">
      <button type="button" className={buttonClass} onClick={handleSync} disabled={syncing} title="Refresh all data from the database">
        <RefreshCw className={`size-3.5 text-[#d66214] ${syncing ? "animate-spin" : ""}`} />
        <span className="hidden xl:inline">Sync data</span>
      </button>
      <button type="button" className={buttonClass} onClick={handleBackup} disabled={backingUp} title="Download a complete JSON data backup">
        <DatabaseBackup className="size-3.5 text-[#d66214]" />
        <span className="hidden xl:inline">Back up</span>
      </button>
      <button type="button" className={buttonClass} onClick={() => importInput.current?.click()} disabled={importBackup.isPending} title="Import and merge a K-Way JSON backup">
        <Upload className="size-3.5 text-[#d66214]" />
        <span className="hidden xl:inline">Import</span>
      </button>
      <input ref={importInput} type="file" accept="application/json,.json" className="sr-only" onChange={event => void handleImportFile(event.target.files?.[0])} />
    </div>
  );
}
