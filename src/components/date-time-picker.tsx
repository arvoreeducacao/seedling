"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, Clock, X } from "@phosphor-icons/react";
import { addDays, addMonths, clampDay, dayDisabled, formatSlot, minutesOfDay, monthGrid, nextBusinessDay, parseTime, sameDay, snapMinutes, startOfDay, timeSlots, timeZoneLabel, withTime } from "@/lib/datetime";
import css from "./date-time-picker.module.css";

type Props = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  name?: string;
  min?: Date | null;
  max?: Date | null;
  ariaLabel?: string;
  placeholder?: string;
  suggestion?: Date;
};

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const slots = timeSlots();

export function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DateTimePicker({ value, onChange, name, min = null, max = null, ariaLabel = "Date and time", placeholder = "Pick a date and time", suggestion }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const times = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState("");
  const fallback = useMemo(() => suggestion ?? nextBusinessDay(), [suggestion]);
  const [cursor, setCursor] = useState<Date>(() => startOfDay(value ?? fallback));
  const [time, setTime] = useState<number>(() => (value ? minutesOfDay(value) : minutesOfDay(fallback)));
  const [typed, setTyped] = useState("");
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const focusDay = useRef(false);

  useEffect(() => setZone(timeZoneLabel(value ?? new Date())), [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    times.current?.querySelector<HTMLElement>(`[data-minutes="${snapMinutes(time)}"]`)?.scrollIntoView({ block: "center" });
  }, [open, time]);

  useEffect(() => {
    if (!open || !focusDay.current) return;
    focusDay.current = false;
    grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [open, cursor]);

  function show() {
    const base = value ?? fallback;
    setCursor(clampDay(startOfDay(base), min, max));
    setTime(minutesOfDay(base));
    setTyped("");
    focusDay.current = true;
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function pickDay(day: Date) {
    if (dayDisabled(day, min, max)) return;
    setCursor(day);
    onChange(withTime(day, time));
  }

  function pickTime(minutes: number) {
    setTime(minutes);
    const day = value ? startOfDay(value) : cursor;
    if (!dayDisabled(day, min, max)) onChange(withTime(day, minutes));
  }

  function moveCursor(next: Date) {
    focusDay.current = true;
    setCursor(clampDay(next, min, max));
  }

  function onGridKey(e: React.KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -cursor.getDay()),
      End: () => addDays(cursor, 6 - cursor.getDay()),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveCursor(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pickDay(cursor);
    }
  }

  function onTimeKey(e: React.KeyboardEvent) {
    const index = slots.indexOf(snapMinutes(time));
    const go = (i: number) => {
      e.preventDefault();
      pickTime(slots[Math.max(0, Math.min(slots.length - 1, i))]);
    };
    if (e.key === "ArrowDown") go(index + 1);
    else if (e.key === "ArrowUp") go(index - 1);
    else if (e.key === "PageDown") go(index + 4);
    else if (e.key === "PageUp") go(index - 4);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slots.length - 1);
  }

  function onPopoverKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function commitTyped() {
    const parsed = parseTime(typed);
    if (parsed !== null) pickTime(snapMinutes(parsed));
    setTyped("");
  }

  const selectedSlot = snapMinutes(time);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const prevDisabled = Boolean(min && monthIndex(cursor) <= monthIndex(min));
  const nextDisabled = Boolean(max && monthIndex(cursor) >= monthIndex(max));
  const suggestionUsable = !dayDisabled(startOfDay(fallback), min, max);

  return (
    <div ref={root} className={css.root}>
      {name && <input type="hidden" name={name} value={value ? value.toISOString() : ""} />}
      <div className={css.field}>
        <button
          ref={trigger}
          type="button"
          className={`input select-trigger ${css.trigger}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-pop` : undefined}
          aria-label={value ? `${ariaLabel}: ${formatDateTime(value)}` : ariaLabel}
          onClick={() => (open ? close(false) : show())}
          onKeyDown={(e) => {
            if (!open && e.key === "ArrowDown") {
              e.preventDefault();
              show();
            }
          }}
          data-el="date-picker-trigger"
        >
          <CalendarBlank size={15} className={css.icon} />
          <span className="value num" style={{ color: value ? undefined : "var(--text-3)" }}>{value ? formatDateTime(value) : placeholder}</span>
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Clear ${ariaLabel.toLowerCase()}`} title="Clear" onClick={() => onChange(null)} data-el="date-picker-clear">
            <X size={13} />
          </button>
        )}
      </div>
      <div className={css.zone} aria-live="polite">{zone ? `Your time zone: ${zone}` : " "}</div>

      {open && (
        <div id={`${id}-pop`} role="dialog" aria-modal="false" aria-label={ariaLabel} className={css.popover} onKeyDown={onPopoverKey} data-el="date-picker">
          <div className={css.panes}>
            <div className={css.calendar}>
              <div className={css.monthBar}>
                <span className={css.month} aria-live="polite">{monthLabel}</span>
                <button type="button" className={`btn btn-ghost btn-sm ${css.today}`} onClick={() => moveCursor(today)}>Today</button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Previous month" disabled={prevDisabled} onClick={() => moveCursor(addMonths(cursor, -1))}><CaretLeft size={13} weight="bold" /></button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Next month" disabled={nextDisabled} onClick={() => moveCursor(addMonths(cursor, 1))}><CaretRight size={13} weight="bold" /></button>
              </div>
              <div ref={grid} role="grid" aria-label={monthLabel} className={css.grid} onKeyDown={onGridKey}>
                <div role="row" className={css.week}>
                  {weekdays.map((d) => <span key={d} role="columnheader" className={css.weekday} aria-label={d}>{d}</span>)}
                </div>
                {Array.from({ length: 6 }, (_, row) => (
                  <div role="row" key={row} className={css.week}>
                    {days.slice(row * 7, row * 7 + 7).map((day) => {
                      const outside = day.getMonth() !== cursor.getMonth();
                      const disabled = dayDisabled(day, min, max);
                      const selected = sameDay(day, value);
                      const focused = sameDay(day, cursor);
                      return (
                        <span role="gridcell" key={day.toISOString()} aria-selected={selected}>
                          <button
                            type="button"
                            tabIndex={focused ? 0 : -1}
                            className={css.day}
                            data-outside={outside || undefined}
                            data-today={sameDay(day, today) || undefined}
                            data-selected={selected || undefined}
                            data-suggested={!value && sameDay(day, fallback) && suggestionUsable ? true : undefined}
                            disabled={disabled}
                            aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                            aria-current={sameDay(day, today) ? "date" : undefined}
                            onClick={() => pickDay(day)}
                            onFocus={() => !sameDay(day, cursor) && setCursor(day)}
                          >
                            {day.getDate()}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className={css.timePane}>
              <label className={`input ${css.timeInput}`}>
                <Clock size={13} className={css.icon} />
                <input
                  value={typed}
                  placeholder={formatSlot(selectedSlot)}
                  onChange={(e) => setTyped(e.target.value)}
                  onBlur={commitTyped}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTyped();
                    }
                  }}
                  aria-label="Type a time"
                  className="num"
                />
              </label>
              <div ref={times} role="listbox" aria-label="Time, in 15 minute steps" tabIndex={0} aria-activedescendant={`${id}-t${selectedSlot}`} className={`${css.times} scroll-thin`} onKeyDown={onTimeKey} data-el="time-list">
                {slots.map((m) => (
                  <div
                    key={m}
                    id={`${id}-t${m}`}
                    role="option"
                    aria-selected={m === selectedSlot}
                    data-minutes={m}
                    className={css.slot}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickTime(m)}
                  >
                    {formatSlot(m)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={css.foot}>
            {!value && suggestionUsable ? (
              <button type="button" className="btn btn-sm" onClick={() => { setCursor(startOfDay(fallback)); setTime(minutesOfDay(fallback)); onChange(fallback); }} data-el="date-picker-suggest">
                {formatDateTime(fallback)}
              </button>
            ) : (
              <span className={css.footZone}>{zone}</span>
            )}
            <span style={{ flex: 1 }} />
            {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Clear</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => close()}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
