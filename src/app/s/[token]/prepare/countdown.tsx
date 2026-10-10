"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { viewerDateTime } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import prep from "../prep.module.css";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor((total % 86_400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export function Countdown({ target, label, compact }: { target: string; label: string; compact?: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const end = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now === null ? null : end - now;
  const p = parts(left ?? 0);
  const units: [Key, number][] =
    p.days > 0
      ? [
          ["prep.unit.days", p.days],
          ["prep.unit.hours", p.hours],
          ["prep.unit.min", p.minutes],
        ]
      : [
          ["prep.unit.hours", p.hours],
          ["prep.unit.min", p.minutes],
          ["prep.unit.sec", p.seconds],
        ];
  const spoken = `${label} ${t("prep.countdown.days", { n: p.days })} ${t("prep.countdown.hours", { n: p.hours })} ${t("prep.countdown.minutes", { n: p.minutes })}`;
  return (
    <div className={`${prep.countdown} ${compact ? prep.countdownCompact : ""}`} role="timer" aria-label={left === null ? label : spoken}>
      <div className={prep.countLabel}>{left !== null && left <= 0 ? t("prep.countdown.now") : label}</div>
      <div className={prep.countUnits}>
        {units.map(([unit, value]) => (
          <div key={unit} className={prep.countUnit}>
            <span className={prep.countValue}>{left === null ? "--" : String(value).padStart(2, "0")}</span>
            <span className={prep.countUnitLabel}>{t(unit, { n: value })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LocalDate({ iso, fallback = "" }: { iso: string; fallback?: string }) {
  const i18n = useI18n();
  const [text, setText] = useState(fallback);
  useEffect(() => setText(viewerDateTime(i18n, new Date(iso))), [iso, i18n]);
  return <span suppressHydrationWarning>{text}</span>;
}
