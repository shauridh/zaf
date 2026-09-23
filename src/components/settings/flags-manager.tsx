"use client";

import { useState, useTransition } from "react";
import type { Flags, FlagKey } from "@/lib/flags";
import { toggleFlag } from "@/lib/actions/flags";

export function FlagsManager({
  initialFlags,
  labelMap,
}: {
  initialFlags: Flags;
  labelMap: Record<FlagKey, string>;
}) {
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [pending, startTransition] = useTransition();

  const onToggle = (key: FlagKey, enabled: boolean) => {
    setFlags((f) => ({ ...f, [key]: enabled }));
    startTransition(async () => {
      const result = await toggleFlag(key, enabled);
      if (!result.ok) {
        setFlags((f) => ({ ...f, [key]: !enabled })); // rollback
        alert(result.error ?? "Gagal menyimpan");
      }
    });
  };

  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {(Object.keys(labelMap) as FlagKey[]).map((key) => (
        <li key={key} className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm font-medium">{labelMap[key]}</span>
          <button
            role="switch"
            aria-checked={flags[key]}
            disabled={pending}
            onClick={() => onToggle(key, !flags[key])}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              flags[key] ? "bg-brand-600" : "bg-stone-300 dark:bg-stone-700"
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${
                flags[key] ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
