export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return Array.from({ length: first.getDay() + last.getDate() }, (_, index) => {
    const day = index - first.getDay() + 1;
    return day < 1 ? null : new Date(month.getFullYear(), month.getMonth(), day);
  });
}

export function monthLabel(month: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);
}

export function readableDate(key: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

export function weekDates(date: Date) {
  const first = new Date(date);
  first.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}
