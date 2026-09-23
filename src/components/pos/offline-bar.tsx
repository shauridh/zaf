"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

const QUEUE_KEY = "cp_offline_orders";

export interface QueuedOrder {
  payload: unknown;
  queuedAt: number;
}

export function enqueueOfflineOrder(payload: unknown): void {
  const list = getQueuedOrders();
  list.push({ payload, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export function getQueuedOrders(): { payload: unknown; queuedAt: number }[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as { payload: unknown; queuedAt: number }[];
  } catch {
    return [];
  }
}

async function tryFlush(): Promise<number> {
  const list = getQueuedOrders();
  if (list.length === 0) return 0;
  const { checkoutOrder } = await import("@/lib/actions/checkout");
  const remaining: typeof list = [];
  let synced = 0;
  for (const item of list) {
    try {
      // Order ini terjadi saat shift masih buka — beri tanda agar penegakan
      // "laci harus terbuka" tidak membuang penjualan nyata saat disinkronkan.
      const payload = { ...(item.payload as Record<string, unknown>), offlineReplay: true };
      const res = await checkoutOrder(payload as never);
      if (res.ok) synced += 1;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return synced;
}

export function OfflineBar() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(getQueuedOrders().length);

    const flush = async () => {
      if (!navigator.onLine) return;
      setSyncing(true);
      const synced = await tryFlush();
      setQueued(getQueuedOrders().length);
      setSyncing(false);
      if (synced > 0) window.dispatchEvent(new Event("cp-offline-synced"));
    };

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(() => {
      setQueued(getQueuedOrders().length);
      if (navigator.onLine && getQueuedOrders().length > 0) void flush();
    }, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={`fixed left-1/2 top-2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-lg transition ${
        online
          ? queued > 0
            ? "bg-amber-500/90 text-white"
            : "hidden"
          : "bg-red-600 text-white"
      }`}
    >
      {!online ? (
        <>
          <WifiOff className="size-3.5" /> OFFLINE — order masuk antrean
        </>
      ) : queued > 0 ? (
        <>
          <RefreshCw className={syncing ? "animate-spin" : ""} /> {queued} order menunggu sinkron
        </>
      ) : null}
    </div>
  );
}

export function WifiIndicator() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online ? (
    <Wifi className="size-4 text-green-500" />
  ) : (
    <WifiOff className="size-4 text-red-500" />
  );
}
