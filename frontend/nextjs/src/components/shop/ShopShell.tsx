import { IBM_Plex_Sans_Thai } from "next/font/google";
import ShopNavBar from "./ShopNavBar";

const thaiSans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/** Layout wrapper for all customer-facing pages (header, background, footer). */
export default function ShopShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${thaiSans.className} flex min-h-screen flex-col bg-slate-50 text-slate-900`}>
      <ShopNavBar />
      <main className={`flex-1 ${className}`}>{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} <span className="font-semibold text-slate-700">Shopdee</span> · ช้อปง่าย จ่ายสะดวก
          </p>
          <p>ชำระเงินปลอดภัยด้วยบัตรเครดิตหรือโอนผ่านธนาคาร</p>
        </div>
      </footer>
    </div>
  );
}

/** Consistent page heading block. */
export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="text-sm font-semibold text-brand-600">{eyebrow}</p> : null}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {description ? <p className="max-w-2xl text-slate-600">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = "error", children, id }: { tone?: "error" | "success" | "info"; children: React.ReactNode; id?: string }) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  }[tone];
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}
