import type { ReactNode } from "react";
import AppHeader from "../navigation/appHeader";
import AppSidebar from "../navigation/appSidebar";

type AppLayoutProps = { children: ReactNode };

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-[#090b0f] text-slate-100">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
