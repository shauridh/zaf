"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, LockKeyhole } from "lucide-react";
import { getOpenShift, type ShiftView } from "@/lib/actions/shifts";
import {
  OpenShiftModal,
  CloseShiftModal,
  CashMovementModal,
} from "@/components/pos/shift-modals";

/**
 * Kontrol laci kas untuk layar Kasir:
 * - Gate: kasir terkunci sampai shift dibuka (modal wajib muncul).
 * - Header actions: Cash In / Cash Out / Tutup Shift — tanpa pindah halaman.
 *   Modal & logika submit hidup di `shift-modals.tsx` (dipakai bersama Keuangan);
 *   komponen ini hanya pemilik state shift + tombol.
 */
export function ShiftControl({
  render,
}: {
  render: (ctx: { hasShift: boolean; openCashModal: (k: "pay_in" | "pay_out") => void; openCloseModal: () => void }) => React.ReactNode;
}) {
  const [shift, setShift] = useState<ShiftView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [cashModal, setCashModal] = useState<"pay_in" | "pay_out" | null>(null);

  const refresh = useCallback(() => {
    getOpenShift()
      .then((s) => {
        setShift(s);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Gate: belum ada shift → paksa modal buka laci (tidak bisa ditutup).
  useEffect(() => {
    if (loaded && !shift) setOpenModal(true);
  }, [loaded, shift]);

  return (
    <>
      {render({
        hasShift: !!shift,
        openCashModal: (k) => setCashModal(k),
        openCloseModal: () => setCloseModal(true),
      })}

      <OpenShiftModal
        open={openModal}
        lock={!shift && loaded}
        onClose={() => setOpenModal(false)}
        onDone={() => {
          setOpenModal(false);
          refresh();
        }}
      />

      <CashMovementModal
        kind={cashModal}
        onClose={() => setCashModal(null)}
        onDone={() => {
          setCashModal(null);
          refresh();
        }}
      />

      <CloseShiftModal
        open={closeModal}
        expected={shift?.expected_cash ?? 0}
        onClose={() => setCloseModal(false)}
        onDone={() => {
          setCloseModal(false);
          setShift(null);
          setOpenModal(true);
        }}
      />
    </>
  );
}

/** Tombol icon header keranjang kasir (cash in / out / tutup shift). */
export function ShiftHeaderButtons({
  hasShift,
  onCash,
  onClose,
}: {
  hasShift: boolean;
  onCash: (k: "pay_in" | "pay_out") => void;
  onClose: () => void;
}) {
  if (!hasShift) {
    return (
      <span title="Laci kas belum dibuka" className="flex items-center text-amber-500">
        <LockKeyhole className="size-5" />
      </span>
    );
  }
  return (
    <>
      <button
        onClick={() => onCash("pay_in")}
        title="Cash In (uang masuk)"
        className="touch-target rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <ArrowDownCircle className="size-5" />
      </button>
      <button
        onClick={() => onCash("pay_out")}
        title="Cash Out (uang keluar)"
        className="touch-target rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <ArrowUpCircle className="size-5" />
      </button>
      <button
        onClick={onClose}
        title="Tutup shift"
        className="touch-target rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <LockKeyhole className="size-5" />
      </button>
    </>
  );
}
