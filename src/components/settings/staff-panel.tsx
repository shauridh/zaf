"use client";

import { useEffect, useState, useTransition } from "react";
import { KeyRound, Plus, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import {
  changeStaffPin,
  createStaff,
  listStaff,
  setStaffActive,
  type StaffMember,
} from "@/lib/actions/staff";
import { Modal } from "@/components/ui/modal";
import { Numpad } from "@/components/ui/numpad";
import { toast } from "@/components/ui/toast";

const ROLE_LABEL: Record<StaffMember["role"], string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Kasir",
};

/** Manajemen user/staf: tambah staf, ganti PIN, aktif/nonaktif — khusus owner. */
export function StaffPanel() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    listStaff()
      .then(setStaff)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal memuat staf"))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const [, startTransition] = useTransition();

  const toggleActive = (m: StaffMember) => {
    startTransition(async () => {
      const res = await setStaffActive(m.id, !m.active);
      if (res.ok) {
        toast.success(m.active ? `${m.name} dinonaktifkan` : `${m.name} diaktifkan`);
        refresh();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Tambah staf, ganti PIN, dan aktifkan/nonaktifkan akun login kasir.
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="touch-target flex items-center gap-1 rounded-btn bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          <Plus className="size-4" /> Staf Baru
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-stone-400">Memuat…</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {staff.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex size-10 items-center justify-center rounded-full ${
                    m.active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      : "bg-stone-100 text-stone-400 dark:bg-stone-800"
                  }`}
                >
                  <UserRound className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {m.name}
                    {m.role === "owner" && (
                      <span className="ml-2 rounded-full bg-stone-800 px-2 py-0.5 text-xs font-bold text-white dark:bg-stone-200 dark:text-stone-900">
                        OWNER
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {ROLE_LABEL[m.role]} · {m.active ? "aktif" : "nonaktif"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setPinTarget(m)}
                  title="Ganti PIN"
                  className="touch-target rounded-lg border border-stone-300 p-2 text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  <KeyRound className="size-4" />
                </button>
                {m.id !== staff.find((s) => s.role === "owner")?.id && (
                  <button
                    onClick={() => toggleActive(m)}
                    title={m.active ? "Nonaktifkan" : "Aktifkan"}
                    className={`touch-target rounded-lg border p-2 ${
                      m.active
                        ? "border-red-200 text-red-500 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10"
                    }`}
                  >
                    {m.active ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} onDone={refresh} />
      <ChangePinModal target={pinTarget} onClose={() => setPinTarget(null)} onDone={refresh} />
    </div>
  );
}

function AddStaffModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setRole("cashier");
      setPin("");
      setError(null);
    }
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      const res = await createStaff(name, role, pin);
      if (res.ok) {
        toast.success("Staf baru tersimpan");
        onDone();
        onClose();
      } else setError(res.error ?? "Gagal");
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Tambah Staf">
      <div className="space-y-4">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama staf"
          className="w-full rounded-btn border border-stone-300 px-4 py-3 font-semibold dark:border-stone-700 dark:bg-stone-800"
        />
        <div className="grid grid-cols-2 gap-2">
          {(["cashier", "manager"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`touch-target rounded-btn border-2 py-3 text-sm font-bold ${
                role === r
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                  : "border-stone-200 dark:border-stone-700"
              }`}
            >
              {r === "cashier" ? "Kasir" : "Manager"}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-stone-600 dark:text-stone-400">
            PIN login (4–6 digit)
          </p>
          <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-2xl font-bold tabular-nums tracking-widest dark:bg-stone-800">
            {pin || "••••"}
          </div>
          <Numpad value={pin} onChange={setPin} />
        </div>
        <button
          onClick={submit}
          disabled={pending || !name.trim() || pin.length < 4}
          className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Simpan Staf"}
        </button>
      </div>
    </Modal>
  );
}

function ChangePinModal({
  target,
  onClose,
  onDone,
}: {
  target: StaffMember | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (target) {
      setOldPin("");
      setNewPin("");
      setError(null);
    }
  }, [target]);

  const submit = () => {
    if (!target) return;
    startTransition(async () => {
      const res = await changeStaffPin(target.id, oldPin, newPin);
      if (res.ok) {
        toast.success(`PIN ${target.name} diganti`);
        onDone();
        onClose();
      } else setError(res.error ?? "Gagal");
    });
  };

  return (
    <Modal open={!!target} onClose={onClose} title={`Ganti PIN — ${target?.name ?? ""}`}>
      <div className="space-y-4">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <div>
          <p className="mb-1 text-sm font-medium text-stone-600 dark:text-stone-400">PIN lama</p>
          <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-xl font-bold tabular-nums tracking-widest dark:bg-stone-800">
            {oldPin || "••••"}
          </div>
          <Numpad value={oldPin} onChange={setOldPin} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-stone-600 dark:text-stone-400">PIN baru</p>
          <div className="rounded-xl bg-stone-100 px-4 py-3 text-right text-xl font-bold tabular-nums tracking-widest dark:bg-stone-800">
            {newPin || "••••"}
          </div>
          <Numpad value={newPin} onChange={setNewPin} />
        </div>
        <button
          onClick={submit}
          disabled={pending || oldPin.length < 4 || newPin.length < 4}
          className="touch-target h-12 w-full rounded-btn bg-brand-600 font-bold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Ganti PIN"}
        </button>
      </div>
    </Modal>
  );
}
