import { dateKey, monthCells } from "../../utils/calendarUtils";

type ActivityCalendarProps = {
  month: Date;
  selectedDate: string;
  counts: Map<string, number>;
  onSelect: (date: string) => void;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityCalendar({ month, selectedDate, counts, onSelect }: ActivityCalendarProps) {
  const today = dateKey(new Date());
  const highestCount = Math.max(...counts.values(), 1);

  return (
    <section aria-label="Monthly hotspot activity calendar">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">{weekdays.map((day) => <span key={day} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {monthCells(month).map((date, index) => {
          if (!date) return <div key={`blank-${index}`} aria-hidden="true" className="min-h-16 rounded-md bg-white/[0.02]" />;
          const key = dateKey(date);
          const count = counts.get(key) ?? 0;
          const selected = key === selectedDate;
          const current = key === today;
          const strength = count ? Math.max(0.2, count / highestCount) : 0;
          return <button key={key} type="button" onClick={() => onSelect(key)} aria-label={`${key}${count ? `, ${count} synthetic detections` : ", no recorded sample data"}`} className={`relative min-h-16 rounded-md border p-1.5 text-left transition hover:border-orange-300/70 focus-visible:outline-2 focus-visible:outline-orange-400 ${selected ? "border-orange-400 bg-orange-500/20" : current ? "border-sky-300/70 bg-sky-300/10" : "border-white/8 bg-[#10131a]"}`}>
            <span className="text-xs text-slate-300">{date.getDate()}</span>
            {count > 0 && <span className="mt-3 block w-fit rounded-full border border-orange-200/40 px-1.5 py-0.5 text-[10px] font-medium text-orange-100" style={{ backgroundColor: `rgba(249, 115, 22, ${0.2 + strength * 0.45})` }}>{count} sample</span>}
            {current && <span className="absolute bottom-1 right-1 text-[9px] text-sky-200">Today</span>}
          </button>;
        })}
      </div>
    </section>
  );
}
