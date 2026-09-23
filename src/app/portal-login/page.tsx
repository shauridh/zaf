"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { portalLogin, portalRegister } from "@/lib/actions/portal-auth";
import { Numpad } from "@/components/ui/numpad";
import { toast } from "@/components/ui/toast";

export default function PortalLoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res =
        mode === "login"
          ? await portalLogin(phone, pin)
          : await portalRegister(phone, name, pin);
      if (res.ok) {
        window.location.href = "/menu";
      } else {
        toast.error(res.error ?? "Gagal");
        setPin("");
      }
    });
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-stone-100 p-4 dark:bg-stone-950">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <Link href="/menu" className="text-5xl">🍗</Link>
          <h1 className="mt-2 text-2xl font-bold">ChickenPOS Portal</h1>
          <p className="text-sm text-stone-500">Pesan antar/ambil sendiri — tanpa aplikasi marketplace</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("login")}
            className={`touch-target rounded-btn border-2 py-2.5 text-sm font-bold ${mode === "login" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700"}`}
          >
            Masuk
          </button>
          <button
            onClick={() => setMode("register")}
            className={`touch-target rounded-btn border-2 py-2.5 text-sm font-bold ${mode === "register" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-stone-200 dark:border-stone-700"}`}
          >
            Daftar
          </button>
        </div>

        <div className="card space-y-4 p-5">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Nomor HP (08…)"
            inputMode="tel"
            className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
          />
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama kamu"
              className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
            />
          )}
          <div className="text-center text-3xl font-bold tracking-[0.4em]">{pin.replace(/./g, "•")}</div>
          <Numpad value={pin} onChange={setPin} onSubmit={submit} submitLabel={pending ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"} disabled={pending} />
        </div>
      </div>
    </main>
  );
}
