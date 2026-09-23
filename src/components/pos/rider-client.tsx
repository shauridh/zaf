"use client";

import { useState, useTransition } from "react";
import { updateJobStatus, type DeliveryJobView } from "@/lib/actions/delivery";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

export function RiderClient({ jobs: initialJobs }: { jobs: DeliveryJobView[] }) {
  const [riderId, setRiderId] = useState("");
  const [pending, startTransition] = useTransition();
  const [jobs] = useState(initialJobs);

  const myJobs = riderId
    ? jobs.filter((j) => j.provider === "internal" && ["assigned", "picked_up"].includes(j.status))
    : [];

  const act = (jobId: string, status: "picked_up" | "delivered") => {
    startTransition(async () => {
      const res = await updateJobStatus(jobId, status);
      if (res.ok) {
        toast.success(status === "picked_up" ? "Pesanan dijemput" : "Pesanan terkirim 🎉");
        window.location.reload();
      } else toast.error(res.error ?? "Gagal");
    });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">🛵 Rider ChickenPOS</h1>

      <input
        value={riderId}
        onChange={(e) => setRiderId(e.target.value)}
        placeholder="ID rider (dari admin) — placeholder sederhana"
        className="w-full rounded-btn border border-stone-300 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
      />

      {myJobs.length === 0 ? (
        <p className="card py-10 text-center text-sm text-stone-400">Belum ada job untukmu.</p>
      ) : (
        myJobs.map((j) => (
          <div key={j.id} className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">#{j.order_number ?? "?"}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", j.status === "assigned" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10")}>
                {j.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-stone-500">📦 {j.address ?? "Alamat di struk"}</p>
            <div className="flex gap-2">
              {j.status === "assigned" && (
                <button
                  onClick={() => act(j.id, "picked_up")}
                  disabled={pending}
                  className="touch-target flex-1 rounded-btn bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Sudah Jemput
                </button>
              )}
              {j.status === "picked_up" && (
                <button
                  onClick={() => act(j.id, "delivered")}
                  disabled={pending}
                  className="touch-target flex-1 rounded-btn bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Sudah Sampai
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
