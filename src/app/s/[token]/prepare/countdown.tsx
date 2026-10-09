"use client";

import { useEffect, useState } from "react";
import prep from "../prep.module.css";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor((total % 86_400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export function Countdown({ target, label, compact }: { target: string; label: string; compact?: boolean }) {
  const end = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now === null ? null : end - now;
  const p = parts(left ?? 0);
  const units: [string, number][] = p.days > 0 ? [["days", p.days], ["hours", p.hours], ["min", p.minutes]] : [["hours", p.hours], ["min", p.minutes], ["sec", p.seconds]];
  return (
    <div className={`${prep.countdown} ${compact ? prep.countdownCompact : ""}`} role="timer" aria-label={left === null ? label : `${label} ${p.days} days ${p.hours} hours ${p.minutes} minutes`}>
      <div className={prep.countLabel}>{left !== null && left <= 0 ? "It's time" : label}</div>
      <div className={prep.countUnits}>
        {units.map(([unit, value]) => (
          <div key={unit} className={prep.countUnit}>
            <span className={prep.countValue}>{left === null ? "--" : String(value).padStart(2, "0")}</span>
            <span className={prep.countUnitLabel}>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LocalDate({ iso, options, fallback = "" }: { iso: string; options: Intl.DateTimeFormatOptions; fallback?: string }) {
  const [text, setText] = useState(fallback);
  useEffect(() => setText(new Date(iso).toLocaleString("en-US", options)), [iso, options]);
  return <span suppressHydrationWarning>{text}</span>;
}
