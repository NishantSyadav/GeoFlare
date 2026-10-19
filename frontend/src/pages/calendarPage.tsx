import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "../components/layout/appLayout";
import ActivityCalendar from "../components/calendar/activityCalendar";
import EmptyState from "../components/common/emptyState";
import { dateKey, monthLabel } from "../utils/calendarUtils";

export default function CalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));

  const setDate = (value: string) => {
    if (!value) return;
    const date = new Date(`${value}T00:00:00`);
    setSelectedDate(value);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const changeMonth = (offset: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">Burning Activity Calendar</h1>
        </header>

        <section className="bg-[#0d1016] p-3 sm:p-5 rounded-lg border border-white/5">
          {/* Controls Bar */}
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {/* Prev / Month / Next */}
            <div className="flex items-center justify-between gap-1 sm:justify-start sm:gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded p-1.5 sm:p-2 text-slate-300 hover:bg-white/5 transition"
                aria-label="Previous month"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-100 tracking-tight">
                {monthLabel(month)}
              </h2>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded p-1.5 sm:p-2 text-slate-300 hover:bg-white/5 transition"
                aria-label="Next month"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Filter selectors */}
            <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:text-sm">
              <label className="flex min-w-0 items-center gap-1.5 text-slate-400">
                <span>Month</span>
                <select
                  value={month.getMonth()}
                  onChange={(event) =>
                    setMonth((current) => new Date(current.getFullYear(), Number(event.target.value), 1))
                  }
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#151a22] px-2 py-1 text-slate-200 outline-none text-xs sm:flex-none sm:text-sm"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index} value={index}>
                      {new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2024, index, 1))}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 items-center gap-1.5 text-slate-400">
                <span>Year</span>
                <input
                  type="number"
                  value={month.getFullYear()}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    if (Number.isInteger(year) && year >= 1 && year <= 9999) {
                      setMonth((current) => new Date(year, current.getMonth(), 1));
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#151a22] px-2 py-1 text-slate-200 outline-none text-xs sm:w-20 sm:flex-none sm:text-sm"
                />
              </label>

              <label className="col-span-2 flex min-w-0 items-center gap-1.5 text-slate-400 sm:col-auto">
                <span>Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setDate(event.target.value)}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#151a22] px-2 py-1 text-slate-200 [color-scheme:dark] outline-none text-xs sm:flex-none sm:text-sm"
                />
              </label>

              <button
                type="button"
                onClick={() => setDate(dateKey(new Date()))}
                className="rounded border border-orange-500/30 px-3 py-1 text-xs sm:text-sm font-medium text-orange-200 hover:bg-orange-500/10 transition"
              >
                Today
              </button>
            </div>
          </div>

          <ActivityCalendar
            month={month}
            selectedDate={selectedDate}
            counts={new Map()}
            onSelect={setDate}
          />

          <div className="mt-5">
            <EmptyState
              title={`No observations for ${selectedDate}`}
              description="Selected-day details will appear here when a real observation source is connected."
            />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
