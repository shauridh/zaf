"use client";

import { useEffect, useState, useTransition } from "react";
import { Numpad } from "@/components/ui/numpad";
import { toast } from "@/components/ui/toast";
import { staffLogin, listStaffProfiles } from "@/lib/actions/auth";

interface StaffLite {
  id: string;
  name: string;
  role: string;
}

export default function LoginPage() {
  const [profiles, setProfiles] = useState<StaffLite[]>([]);
  const [selected, setSelected] = useState<StaffLite | null>(null);
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();
  const [dbReady, setDbReady] = useState(true);

  useEffect(() => {
    listStaffProfiles()
      .then((list) => {
        setProfiles(list);
        if (list.length === 0) setDbReady(false);
      })
      .catch(() => setDbReady(false));
  }, []);

  const submit = () => {
    if (!selected || pin.length < 4) return;
    startTransition(async () => {
      const result = await staffLogin(selected.id, pin);
      if (result.ok) {
        window.location.href = "/register";
      } else {
        toast.error(result.error ?? "Login gagal");
        setPin("");
      }
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-100 p-4 dark:bg-stone-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="text-5xl">🍗</span>
          <h1 className="mt-2 text-2xl font-bold">ChickenPOS</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">Masuk dengan PIN staf</p>
        </div>

        {!dbReady && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Database belum terhubung. Isi <code>.env.local</code> sesuai{" "}
            <code>.env.example</code>, lalu jalankan migrasi &amp; seed SQL di folder{" "}
            <code>supabase/</code>.
          </div>
        )}

        {!selected ? (
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="touch-target flex w-full items-center justify-between rounded-btn border border-stone-200 bg-white px-5 py-4 text-left text-lg font-semibold transition hover:border-brand-400 active:scale-[0.99] dark:border-stone-800 dark:bg-stone-900"
              >
                <span>{p.name}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-stone-800">
                  {p.role}
                </span>
              </button>
            ))}
            {profiles.length === 0 && dbReady && <p className="text-center text-sm text-stone-500">Memuat…</p>}
          </div>
        ) : (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selected.name}</span>
              <button onClick={() => { setSelected(null); setPin(""); }} className="text-sm text-brand-600 hover:underline">
                Ganti
              </button>
            </div>
            <div className="text-center text-4xl font-bold tracking-[0.5em] tabular-nums">
              {pin.replace(/./g, "•")}
            </div>
            <Numpad
              value={pin}
              onChange={setPin}
              onSubmit={submit}
              submitLabel={pending ? "Memeriksa…" : "Masuk"}
              disabled={pending}
            />
          </div>
        )}
      </div>
    </main>
  );
}
