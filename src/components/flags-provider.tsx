"use client";

import { createContext, useContext } from "react";
import type { Flags } from "@/lib/flags";

const FlagsContext = createContext<Flags | null>(null);

export function FlagsProvider({ flags, children }: { flags: Flags; children: React.ReactNode }) {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

export function useFlags(): Flags {
  const flags = useContext(FlagsContext);
  if (!flags) throw new Error("useFlags harus dipakai di dalam FlagsProvider");
  return flags;
}

/** Helper: true bila semua flag yang diberikan aktif. */
export function flagsEnabled(flags: Flags, ...keys: (keyof Flags)[]): boolean {
  return keys.every((k) => flags[k]);
}
