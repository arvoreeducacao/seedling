"use client";

import { useState } from "react";
import { SegButtons } from "@/components/motion";

type Option<T extends string> = { value: T; label: React.ReactNode };

export function Segmented<T extends string>({ name, value, defaultValue, onChange, options, ariaLabel, block }: { name?: string; value?: T; defaultValue?: T; onChange?: (value: T) => void; options: Option<T>[]; ariaLabel: string; block?: boolean }) {
  const [inner, setInner] = useState<T>(defaultValue ?? options[0].value);
  const current = value ?? inner;
  function pick(next: T) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <SegButtons ariaLabel={ariaLabel} value={current} onChange={pick} options={options} block={block} />
    </>
  );
}
