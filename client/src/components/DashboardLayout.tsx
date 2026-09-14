import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bell,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PanelLeft,
  ReceiptText,
  Truck,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export type PortalTab = "dashboard" | "trucks" | "tracking" | "income" | "expenses" | "maintenance" | "invoices" | "reports";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" as const },
  { icon: Truck, label: "Trucks", id: "trucks" as const },
  { icon: MapPinned, label: "Truck Tracking", id: "tracking" as const },
  { icon: WalletCards, label: "Income", id: "income" as const },
  { icon: ReceiptText, label: "Expenses", id: "expenses" as const },
  { icon: Wrench, label: "Maintenance", id: "maintenance" as const },
  { icon: FileText, label: "Invoices", id: "invoices" as const },
  { icon: BarChart3, label: "Profit & Loss", id: "reports" as const },
];

export default function DashboardLayout({
  children,
  activeTab,
  onNavigate,
  onLogout,
  alertCount,
  dataActions,
}: {
  children: ReactNode;
  activeTab: PortalTab;
  onNavigate: (tab: PortalTab) => void;
  onLogout: () => void;
  alertCount: number;
  dataActions?: ReactNode;
}) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "254px" } as CSSProperties}>
      <DashboardLayoutContent activeTab={activeTab} onNavigate={onNavigate} onLogout={onLogout} alertCount={alertCount} dataActions={dataActions}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  activeTab,
  onNavigate,
  onLogout,
  alertCount,
  dataActions,
}: {
  children: ReactNode;
  activeTab: PortalTab;
  onNavigate: (tab: PortalTab) => void;
  onLogout: () => void;
  alertCount: number;
  dataActions?: ReactNode;
}) {
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const activeLabel = menuItems.find(item => item.id === activeTab)?.label ?? "Dashboard";
  const handleNavigate = (tab: PortalTab) => {
    onNavigate(tab);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="border-b border-white/8 bg-[#0c2033] p-4">
          <div className="flex min-h-10 items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ff8c35] text-[#0c2033] transition-transform active:scale-95"
              aria-label="Toggle navigation"
            >
              {isCollapsed ? <Truck className="size-[18px]" strokeWidth={2.5} /> : <PanelLeft className="size-[18px]" strokeWidth={2.5} />}
            </button>
            {!isCollapsed ? (
              <div className="leading-none">
                <span className="font-display block text-xl font-bold tracking-[0.03em] text-white uppercase">K-Way</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.3em] text-white/40 uppercase">Operations</span>
              </div>
            ) : null}
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-[#0c2033] px-2 py-5">
          {!isCollapsed ? <p className="mb-3 px-3 text-[9px] font-bold tracking-[0.18em] text-white/35 uppercase">Workspace</p> : null}
          <SidebarMenu className="gap-1">
            {menuItems.map(item => {
              const isActive = item.id === activeTab;
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => handleNavigate(item.id)}
                    tooltip={item.label}
                    className={`h-11 rounded-xl border-0 px-3 text-xs font-bold transition-all ${isActive ? "bg-[#ff8c35] text-[#0c2033] shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:bg-[#ff9a4b]" : "text-white/60 hover:bg-white/7 hover:text-white"}`}
                  >
                    <item.icon className="size-[17px]" strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/8 bg-[#0c2033] p-3">
          {!isCollapsed && alertCount > 0 ? (
            <button type="button" onClick={() => handleNavigate("trucks")} className="mb-3 flex w-full items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/8 p-3 text-left">
              <Bell className="mt-0.5 size-4 shrink-0 text-[#ff9a4b]" />
              <span><span className="block text-[10px] font-extrabold text-white">{alertCount} document alert{alertCount === 1 ? "" : "s"}</span><span className="mt-1 block text-[9px] leading-4 text-white/45">Expiry within 14 days</span></span>
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/7 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c35]">
                <Avatar className="size-9 shrink-0 border border-white/10">
                  <AvatarFallback className="bg-white/10 text-xs font-bold text-white">SO</AvatarFallback>
                </Avatar>
                {!isCollapsed ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">Sales Operations</p>
                    <p className="mt-1 truncate text-[9px] text-white/40">sales@k-way.co.tz</p>
                  </div>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52">
              <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 size-4" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#f5f6f3]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e3e7e5] bg-[#f7f8f5]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {isMobile ? <SidebarTrigger className="size-9 rounded-xl border border-[#dfe4e2] bg-white" /> : null}
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.16em] text-[#d66214] uppercase">K-Way Limited</p>
              <p className="font-display text-lg font-bold tracking-wide text-[#10263c] uppercase">{activeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dataActions}
            <button type="button" onClick={() => onNavigate("income")} className="hidden h-9 items-center gap-2 rounded-xl border border-[#dfe4e2] bg-white px-3 text-[10px] font-extrabold text-[#425466] shadow-sm transition-colors hover:text-[#c9580e] sm:flex">
              <CircleDollarSign className="size-4 text-[#d66214]" />Record income
            </button>
            <button type="button" onClick={() => onNavigate("trucks")} className="relative flex size-9 items-center justify-center rounded-xl border border-[#dfe4e2] bg-white text-[#61707d] shadow-sm">
              <Bell className="size-4" />
              {alertCount > 0 ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#e4671a] text-[8px] font-bold text-white">{Math.min(alertCount, 9)}</span> : null}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
