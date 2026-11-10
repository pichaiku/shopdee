"use client";

import { useState, type FormEvent } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { payWithCard } from "@/lib/api";
import { createCardToken, detectBrand, luhnValid } from "@/lib/omise";
import { formatBaht, getCustomerSession, getErrorMessage } from "@/lib/session";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50";

export default function CardPaymentForm({ orderID, amount, onPaid }: { orderID: number; amount: number; onPaid: () => void }) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = number.replace(/\D/g, "");
  const brand = detectBrand(digits);

  const validate = (): string | null => {
    if (!luhnValid(digits)) return "หมายเลขบัตรไม่ถูกต้อง";
    if (!name.trim()) return "กรุณากรอกชื่อบนบัตร";
    const [mm, yy] = expiry.split("/");
    const month = Number(mm);
    const year = 2000 + Number(yy);
    if (!mm || !yy || yy.length !== 2 || month < 1 || month > 12) return "วันหมดอายุต้องอยู่ในรูปแบบ MM/YY";
    const now = new Date();
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return "บัตรหมดอายุแล้ว";
    if (!/^\d{3,4}$/.test(cvc)) return "CVV ต้องเป็นตัวเลข 3-4 หลัก";
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const session = getCustomerSession();
    if (!session) {
      setError("กรุณาเข้าสู่ระบบก่อนชำระเงิน");
      return;
    }

    setProcessing(true);
    try {
      const [mm, yy] = expiry.split("/");
      const paymentToken = await createCardToken({
        name: name.trim(),
        number: digits,
        expiration_month: Number(mm),
        expiration_year: 2000 + Number(yy),
        security_code: cvc,
      });
      await payWithCard(Number(session.user.id), orderID, paymentToken, session.token);
      onPaid();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "ชำระเงินไม่สำเร็จ");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Card preview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-5 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <CreditCard className="h-7 w-7 text-white/80" />
          <span className="text-sm font-bold tracking-wider">{brand ?? "CARD"}</span>
        </div>
        <p className="relative mt-6 font-mono text-lg tracking-[0.2em] sm:text-xl">{number || "•••• •••• •••• ••••"}</p>
        <div className="relative mt-4 flex justify-between text-xs uppercase text-white/70">
          <span className="truncate pr-4">{name || "ชื่อบนบัตร"}</span>
          <span>{expiry || "MM/YY"}</span>
        </div>
      </div>

      <div>
        <label htmlFor="card-number" className="text-sm font-medium text-slate-700">หมายเลขบัตร</label>
        <input
          id="card-number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={number}
          disabled={processing}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "))}
          className={`${inputClass} font-mono tracking-wider`}
        />
      </div>
      <div>
        <label htmlFor="card-name" className="text-sm font-medium text-slate-700">ชื่อบนบัตร</label>
        <input id="card-name" autoComplete="cc-name" placeholder="SOMCHAI JAIDEE" value={name} disabled={processing} onChange={(e) => setName(e.target.value.toUpperCase())} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="card-expiry" className="text-sm font-medium text-slate-700">วันหมดอายุ</label>
          <input
            id="card-expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={expiry}
            disabled={processing}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="card-cvc" className="text-sm font-medium text-slate-700">CVV</label>
          <input id="card-cvc" type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" value={cvc} disabled={processing} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass} />
        </div>
      </div>

      {error ? (
        <p id="payment-error" role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        id="pay-now"
        type="submit"
        disabled={processing}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:bg-slate-300 disabled:shadow-none"
      >
        {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
        {processing ? "กำลังชำระเงิน..." : `ชำระเงิน ${formatBaht(amount)}`}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" /> ข้อมูลบัตรส่งตรงไปยัง Omise อย่างปลอดภัย ร้านค้าไม่เก็บข้อมูลบัตร
      </p>
    </form>
  );
}
