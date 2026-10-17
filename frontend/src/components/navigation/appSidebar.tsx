import { BarChart3, CalendarDays, Flame, Map, TriangleAlert } from "lucide-react";
import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "Map", to: "/map", icon: Map },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Trends", to: "/trends", icon: BarChart3 },
  { label: "Anomalies", to: "/anomalies", icon: TriangleAlert },
];

export default function AppSidebar() {
  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-white/10 bg-[#0d1016] sm:w-56">
      <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <span className="grid size-8 place-items-center rounded-md bg-orange-500 text-black"><Flame size={18} /></span>
        <span className="hidden text-sm font-semibold tracking-wide sm:block">GeoFlare</span>
      </div>
      <nav className="space-y-1 p-2" aria-label="Application navigation">
        {navigationItems.map(({ label, to, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${isActive ? "bg-orange-500/15 text-orange-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}>
            <Icon size={18} />
            <span className="hidden sm:block">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
