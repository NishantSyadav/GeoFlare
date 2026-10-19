import { Download, Flame, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

const items = [{ label: "Calendar", to: "/calendar" }, { label: "Map", to: "/map" }, { label: "Trends", to: "/trends" }, { label: "Anomalies", to: "/anomalies" }, { label: "Reports", to: "/reports" }];
const linkClass = ({ isActive }: { isActive: boolean }) => `rounded-md px-4 py-2 text-sm font-medium transition ${isActive ? "bg-orange-500/15 text-orange-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`;

export default function AppHeader() {
  const [open, setOpen] = useState(false);
  return <header className="relative z-30 shrink-0 border-b border-white/10 bg-[#0d1016]">
    <div className="flex h-14 w-full items-center gap-1 px-3 sm:gap-2 sm:px-4">
      <NavLink to="/calendar" className="mr-1 flex shrink-0 items-center gap-2 font-semibold tracking-wide sm:mr-2"><span className="grid size-7 place-items-center rounded bg-orange-500 text-black"><Flame size={18} /></span><span className="hidden min-[380px]:inline">GeoFlare</span></NavLink>
      {/* Nav tabs spread evenly across remaining space */}
      <nav className="hidden flex-1 items-center justify-evenly lg:flex" aria-label="Application navigation">{items.map(item => <NavLink key={item.to} to={item.to} className={linkClass}>{item.label}</NavLink>)}</nav>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NavLink to="/reports" title="Choose an available report to download" aria-label="Download report" className="flex items-center gap-2 rounded-md bg-orange-500 px-2 py-2 text-xs font-semibold text-black hover:bg-orange-400 sm:px-3 sm:text-sm"><Download size={16} /><span className="hidden min-[430px]:inline">Download <span className="hidden sm:inline">report</span></span></NavLink>
        <NavLink to="/profile" aria-label="Your profile" title="Your profile" className={({ isActive }) => `rounded-md p-2 ${isActive ? "bg-orange-500/15 text-orange-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><UserRound size={19} /></NavLink>
        <button type="button" onClick={() => setOpen(value => !value)} className="rounded-md p-2 text-slate-300 hover:bg-white/5 lg:hidden" aria-label="Toggle navigation" aria-expanded={open} aria-controls="mobile-navigation">{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" className="absolute inset-x-0 top-full border-b border-white/10 bg-[#0d1016] px-3 py-2 shadow-xl lg:hidden" aria-label="Mobile application navigation">{[...items, {label: "Profile", to: "/profile"}].map(item => <NavLink key={item.to} onClick={() => setOpen(false)} to={item.to} className={state => `${linkClass(state)} block`}>{item.label}</NavLink>)}</nav>}
  </header>;
}
