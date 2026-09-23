"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { startTwofaEnroll, enableTwofa, disableTwofa } from "@/lib/actions/security";
import { toast } from "@/components/ui/toast";

export function TwofaPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enroll, setEnroll] = useState<null | { secret: string; otpauth: string }>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const begin = () => {
    startTransition(async () => {
      const res = await startTwofaEnroll();
      if (res.ok && res.secret && res.otpauth) setEnroll({ secret: res.secret, otpauth: res.otpauth });
      else toast.error(res.error ?? "Gagal");
    });
  };

  const confirm = () => {
    if (!enroll) return;
    startTransition(async () => {
      const res = await enableTwofa(enroll.secret, code);
      if (res.ok) {
        toast.success("2FA aktif");
        setEnabled(true);
        setEnroll(null);
        setCode("");
      } else toast.error(res.error ?? "Gagal");
    });
  };

  const turnOff = () => {
    startTransition(async () => {
      const res = await disableTwofa(code);
      if (res.ok) {
        toast.success("2FA dinonaktifkan");
        setEnabled(false);
        setCode("");
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {enabled ? <ShieldCheck className="text-green-600" /> : <ShieldOff className="text-stone-400" />}
        Keamanan — 2FA Owner
      </h2>
      {enabled ? (
        <>
          <p className="text-sm text-stone-500">
            2FA aktif. Kode autentikator diminta saat aksi sensitif owner.
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="Kode 6 digit utk nonaktifkan"
              className="flex-1 rounded-btn border border-stone-300 px-4 py-3 tabular-nums dark:border-stone-700 dark:bg-stone-800"
            />
            <button
              onClick={turnOff}
              disabled={pending || code.length !== 6}
              className="rounded-btn bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Nonaktifkan
            </button>
          </div>
        </>
      ) : enroll ? (
        <>
          <p className="text-sm text-stone-500">
            1. Scan QR / masukkan secret ke aplikasi authenticator (Google Authenticator, Aegis, dll):
          </p>
          <code className="block overflow-x-auto rounded-xl bg-stone-100 p-3 text-xs dark:bg-stone-800">
            {enroll.otpauth}
          </code>
          <p className="text-xs text-stone-400">Secret: {enroll.secret}</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="Kode 6 digit"
              className="flex-1 rounded-btn border border-stone-300 px-4 py-3 tabular-nums dark:border-stone-700 dark:bg-stone-800"
            />
            <button
              onClick={confirm}
              disabled={pending || code.length !== 6}
              className="rounded-btn bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Verifikasi
            </button>
            <button onClick={() => setEnroll(null)} className="rounded-btn border border-stone-300 px-4 text-sm font-bold dark:border-stone-700">
              Batal
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-500">
            Lapisan kedua (TOTP) untuk aksi sensitif owner. Tidak wajib — aktifkan bila perlu.
          </p>
          <button
            onClick={begin}
            disabled={pending}
            className="rounded-btn bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            Aktifkan 2FA
          </button>
        </>
      )}
    </div>
  );
}
