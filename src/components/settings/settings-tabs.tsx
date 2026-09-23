"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export type SettingsTabKey = "gerai" | "struk" | "keamanan" | "fitur" | "staf";

const TABS: { key: SettingsTabKey; label: string; icon: string }[] = [
  { key: "gerai", label: "Gerai", icon: "🏪" },
  { key: "struk", label: "Struk & Printer", icon: "🖨" },
  { key: "keamanan", label: "Keamanan", icon: "🔐" },
  { key: "fitur", label: "Fitur & Modul", icon: "🧩" },
  { key: "staf", label: "Staf & PIN", icon: "👥" },
];

/**
 * Sub-menu Pengaturan. Isi tiap tab dikirim dari server component sebagai
 * slot React (children per tab) sehingga panel server tetap dirender normal.
 */
export function SettingsTabs({
  gerai,
  struk,
  keamanan,
  fitur,
  staf,
}: {
  gerai: React.ReactNode;
  struk: React.ReactNode;
  keamanan: React.ReactNode;
  fitur: React.ReactNode;
  staf: React.ReactNode;
}) {
  const [tab, setTab] = useState<SettingsTabKey>("gerai");

  return (
    <div className="space-y-5">
      <nav className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "touch-target flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold",
              tab === t.key
                ? "bg-brand-600 text-white shadow"
                : "bg-white text-stone-600 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
            )}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <div className={tab === "gerai" ? "" : "hidden"}>{gerai}</div>
      <div className={tab === "struk" ? "" : "hidden"}>{struk}</div>
      <div className={tab === "keamanan" ? "" : "hidden"}>{keamanan}</div>
      <div className={tab === "fitur" ? "" : "hidden"}>{fitur}</div>
      <div className={tab === "staf" ? "" : "hidden"}>{staf}</div>
    </div>
  );
}
