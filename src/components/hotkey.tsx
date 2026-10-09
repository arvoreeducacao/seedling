"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function Hotkey({ keyName, href }: { keyName: string; href: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (keyName !== "Escape" && (e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, [contenteditable=true]"))) return;
      if (e.key.toLowerCase() === keyName.toLowerCase()) {
        e.preventDefault();
        router.push(href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyName, href, router]);
  return null;
}
