import DashboardLayout, { type PortalTab } from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import DataControls from "./DataControls";
import ExpensesTab from "./ExpensesTab";
import IncomeTab from "./IncomeTab";
import MaintenanceTab from "./MaintenanceTab";
import OverviewTab from "./OverviewTab";
import ReportsTab from "./ReportsTab";
import TrackingTab from "./TrackingTab";
import TrucksTab from "./TrucksTab";

export default function PortalDashboard() {
  const [activeTab, setActiveTab] = useState<PortalTab>("dashboard");
  const utils = trpc.useUtils();
  const trucksQuery = trpc.portal.trucks.list.useQuery(undefined, { retry: 1 });
  const incomeQuery = trpc.portal.income.list.useQuery(undefined, { retry: 1 });
  const expenseQuery = trpc.portal.expenses.list.useQuery(undefined, { retry: 1 });
  const maintenanceQuery = trpc.portal.maintenance.list.useQuery(undefined, { retry: 1 });
  const logout = trpc.portal.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.portal.auth.status.invalidate();
      toast.success("Signed out securely");
    },
  });

  const trucks = trucksQuery.data ?? [];
  const incomes = incomeQuery.data ?? [];
  const expenses = expenseQuery.data ?? [];
  const maintenance = maintenanceQuery.data ?? [];
  const alertCount = trucks.flatMap(truck => truck.documents).filter(document => document.expiryDate <= Date.now() + 14 * 86400000).length;

  const renderTab = () => {
    switch (activeTab) {
      case "trucks":
        return <TrucksTab trucks={trucks} isLoading={trucksQuery.isLoading} />;
      case "tracking":
        return <TrackingTab incomes={incomes} expenses={expenses} trucks={trucks} />;
      case "income":
        return <IncomeTab incomes={incomes} trucks={trucks} expenses={expenses} isLoading={incomeQuery.isLoading} />;
      case "expenses":
        return <ExpensesTab expenses={expenses} incomes={incomes} trucks={trucks} isLoading={expenseQuery.isLoading} />;
      case "maintenance":
        return <MaintenanceTab records={maintenance} trucks={trucks} isLoading={maintenanceQuery.isLoading} />;
      case "reports":
        return <ReportsTab incomes={incomes} expenses={expenses} trucks={trucks} />;
      default:
        return <OverviewTab trucks={trucks} incomes={incomes} expenses={expenses} />;
    }
  };

  const hasError = trucksQuery.error || incomeQuery.error || expenseQuery.error || maintenanceQuery.error;

  return (
    <DashboardLayout activeTab={activeTab} onNavigate={setActiveTab} onLogout={() => logout.mutate()} alertCount={alertCount} dataActions={<DataControls />}>
      {hasError ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          Some portal data could not be loaded. Refresh the page or try again shortly.
        </div>
      ) : null}
      {renderTab()}
    </DashboardLayout>
  );
}
