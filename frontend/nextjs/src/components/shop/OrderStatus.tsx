import { CheckCircle2, Clock, CreditCard, PackageCheck, Search, Truck } from "lucide-react";

export const ORDER_STEPS = [
  { id: 1, label: "รอชำระเงิน", icon: Clock },
  { id: 2, label: "ตรวจสอบการชำระ", icon: Search },
  { id: 3, label: "ชำระแล้ว", icon: CreditCard },
  { id: 4, label: "กำลังจัดส่ง", icon: Truck },
  { id: 5, label: "ส่งสำเร็จ", icon: PackageCheck },
];

const BADGE: Record<number, string> = {
  1: "bg-amber-50 text-amber-700 ring-amber-200",
  2: "bg-sky-50 text-sky-700 ring-sky-200",
  3: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  4: "bg-violet-50 text-violet-700 ring-violet-200",
  5: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ statusID, statusName }: { statusID: number; statusName?: string }) {
  const label = statusName || ORDER_STEPS.find((s) => s.id === Number(statusID))?.label || "ไม่ทราบสถานะ";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BADGE[Number(statusID)] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {label}
    </span>
  );
}

export function StatusTimeline({ statusID }: { statusID: number }) {
  const current = Number(statusID);
  // A card payment jumps straight from 1 to 3, so step 2 only shows as done when it actually happened
  return (
    <ol id="tracking-timeline" className="grid grid-cols-5 gap-1">
      {ORDER_STEPS.map((step, index) => {
        const done = current > step.id || current === 5;
        const active = current === step.id && current !== 5;
        const Icon = done ? CheckCircle2 : step.icon;
        return (
          <li key={step.id} className="relative flex flex-col items-center text-center">
            {index > 0 && <span className={`absolute right-1/2 top-5 h-0.5 w-full -translate-y-1/2 ${current >= step.id ? "bg-brand-500" : "bg-slate-200"}`} />}
            <span
              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                done ? "border-brand-500 bg-brand-500 text-white" : active ? "border-brand-500 bg-white text-brand-600 ring-4 ring-brand-100" : "border-slate-200 bg-white text-slate-300"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={`mt-2 text-[11px] font-medium leading-tight sm:text-xs ${done || active ? "text-slate-900" : "text-slate-400"}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
