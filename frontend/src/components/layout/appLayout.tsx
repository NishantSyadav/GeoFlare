import type { ReactNode } from "react";
import AppHeader from "../navigation/appHeader";

type AppLayoutProps = { children: ReactNode; fullHeight?: boolean };

export default function AppLayout({ children, fullHeight = false }: AppLayoutProps) {
  return <div className={`flex flex-col bg-[#090b0f] text-slate-100 ${fullHeight ? "h-dvh overflow-hidden" : "min-h-dvh"}`}><AppHeader /><main className="min-h-0 flex-1">{children}</main></div>;
}
