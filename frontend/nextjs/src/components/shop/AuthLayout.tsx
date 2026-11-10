import { ShoppingBag, Sparkles, CreditCard, Truck } from "lucide-react";
import ShopShell from "./ShopShell";

/** Two-column layout for login / register. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopShell>
      <div className="mx-auto grid max-w-6xl items-stretch gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-fuchsia-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-2xl font-bold">
            <ShoppingBag className="h-7 w-7" /> Shopdee
          </div>
          <div className="relative space-y-6">
            <h2 className="text-4xl font-bold leading-tight">ช้อปของดี<br />ได้ทุกที่ ทุกเวลา</h2>
            <ul className="space-y-3 text-white/90">
              <li className="flex items-center gap-3"><Sparkles className="h-5 w-5" /> สินค้าแนะนำเฉพาะคุณจากประวัติการซื้อ</li>
              <li className="flex items-center gap-3"><CreditCard className="h-5 w-5" /> จ่ายด้วยบัตรเครดิตหรือโอนผ่านธนาคาร</li>
              <li className="flex items-center gap-3"><Truck className="h-5 w-5" /> ติดตามสถานะคำสั่งซื้อได้ตลอด</li>
            </ul>
          </div>
          <p className="relative text-sm text-white/70">© {new Date().getFullYear()} Shopdee</p>
        </div>
        <div className="flex items-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10">{children}</div>
        </div>
      </div>
    </ShopShell>
  );
}

export const authInputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100";
