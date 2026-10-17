import { Bell, FileDown } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1016] px-4 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-slate-100">Fire monitoring</p>
        <p className="text-xs text-slate-500">Live observation workspace</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" title="Alerts will be available when connected to live monitoring data" className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200" aria-label="Alerts">
          <Bell size={18} />
        </button>
        <button type="button" title="Reports will be available when analysis data is connected" className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200" aria-label="Reports">
          <FileDown size={18} />
        </button>
      </div>
    </header>
  );
}
