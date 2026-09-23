"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { redeemPoints } from "@/lib/actions/members";
import { Numpad } from "@/components/ui/numpad";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils/format";

interface MemberLite {
  id: string;
  name: string;
  phone: string;
  points: number;
}

export function MembersClient({ members }: { members: MemberLite[] }) {
  const [redeemFor, setRedeemFor] = useState<MemberLite | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card divide-y divide-stone-100 dark:divide-stone-800">
      {members.length === 0 && (
        <p className="py-12 text-center text-sm text-stone-400">
          Belum ada member. Member dibuat otomatis saat order dengan nomor HP.
        </p>
      )}
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold">{m.name || "—"}</p>
            <p className="text-xs text-stone-500">{m.phone}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {m.points.toLocaleString("id-ID")} poin
            </span>
            <button
              onClick={() => setRedeemFor(m)}
              disabled={m.points < 1}
              className="touch-target flex items-center gap-1 rounded-btn border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-30 dark:border-stone-700"
            >
              <Gift className="size-4" /> Redeem
            </button>
          </div>
        </div>
      ))}

      <Modal open={!!redeemFor} onClose={() => setRedeemFor(null)} title={`Redeem Poin — ${redeemFor?.name ?? ""}`}>
        {redeemFor && (
          <RedeemForm
            member={redeemFor}
            pending={pending}
            onSubmit={(points) =>
              startTransition(async () => {
                const res = await redeemPoints(redeemFor.id, points);
                if (res.ok) {
                  toast.success(`Redeem berhasil: ${formatRupiah(res.value ?? 0)}`);
                  setRedeemFor(null);
                  window.location.reload();
                } else toast.error(res.error ?? "Gagal");
              })
            }
          />
        )}
      </Modal>
    </div>
  );
}

function RedeemForm({
  member,
  onSubmit,
  pending,
}: {
  member: MemberLite;
  onSubmit: (points: number) => void;
  pending: boolean;
}) {
  const [points, setPoints] = useState("");
  const p = parseInt(points, 10) || 0;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-stone-100 p-4 text-center dark:bg-stone-800">
        <p className="text-xs uppercase text-stone-500">Nilai redeem</p>
        <p className="text-2xl font-bold">{formatRupiah(p * 100)}</p>
        <p className="mt-1 text-xs text-stone-500">
          Saldo: {member.points.toLocaleString("id-ID")} poin
        </p>
      </div>
      <Numpad
        value={points}
        onChange={setPoints}
        submitLabel="Redeem"
        disabled={pending}
        onSubmit={() => onSubmit(p)}
      />
    </div>
  );
}
