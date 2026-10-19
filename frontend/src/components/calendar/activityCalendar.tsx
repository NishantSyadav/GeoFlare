import { dateKey, monthCells } from "../../utils/calendarUtils";

type ActivityCalendarProps = {
  month: Date;
  selectedDate: string;
  counts: Map<string, number>;
  onSelect: (date: string) => void;
};

// Weekday abbreviations — single letter for dense grid
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Returns a Tailwind bg class for the GitHub-style intensity level (0–4).
 * Level 0 = no data (dark cell), level 4 = highest activity (brightest orange).
 */
function intensityClass(level: 0 | 1 | 2 | 3 | 4, selected: boolean, isToday: boolean): string {
  if (selected) return "bg-orange-400 ring-2 ring-orange-300 ring-offset-1 ring-offset-[#090b0f]";
  if (isToday) return "bg-sky-500/30 ring-1 ring-sky-400/60";
  switch (level) {
    case 1: return "bg-orange-900/50";
    case 2: return "bg-orange-700/60";
    case 3: return "bg-orange-500/75";
    case 4: return "bg-orange-400";
    default: return "bg-white/[0.05]";
  }
}

function getLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

export default function ActivityCalendar({ month, selectedDate, counts, onSelect }: ActivityCalendarProps) {
  const today = dateKey(new Date());
  const cells = monthCells(month);
  const highestCount = Math.max(...counts.values(), 1);

  return (
    <section aria-label="Monthly hotspot activity calendar" className="w-full">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-widest">
            {d}
          </span>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`blank-${index}`}
                aria-hidden="true"
                className="h-10 w-full rounded-[3px] bg-white/[0.02] sm:h-14 lg:h-16"
              />
            );
          }

          const key = dateKey(date);
          const count = counts.get(key) ?? 0;
          const level = getLevel(count, highestCount);
          const selected = key === selectedDate;
          const isToday = key === today;
          const label = `${key}${count ? `, ${count} detections` : ", no data"}`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={label}
              title={label}
              className={`group relative h-12 sm:h-14 lg:h-16 w-full rounded-[3px] transition-all duration-100 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-orange-400 ${intensityClass(level, selected, isToday)}`}
            >
              {/* Date number — larger, prominent, and clearly readable */}
              <span
                className={`absolute inset-0 flex select-none items-center justify-center text-[11px] font-medium transition-colors sm:text-xs md:text-sm ${
                  selected
                    ? "text-slate-950"
                    : isToday
                    ? "text-sky-200"
                    : "text-slate-200 group-hover:text-white"
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-slate-500">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span
            key={l}
            className={`inline-block h-3 w-3 rounded-[2px] ${intensityClass(l, false, false)}`}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
