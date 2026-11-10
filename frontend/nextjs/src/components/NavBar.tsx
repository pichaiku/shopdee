"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SessionState {
  type: "customer" | "admin" | null;
  name: string;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionState>({ type: null, name: "" });

  useEffect(() => {
    const raw = localStorage.getItem("shopdee_user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSession({ type: parsed.type, name: parsed.firstName ?? parsed.username ?? "User" });
      } catch {
        setSession({ type: null, name: "" });
      }
    }
  }, []);

  const onLogout = () => {
    localStorage.removeItem("shopdee_token");
    localStorage.removeItem("shopdee_user");
    router.push("/login");
  };

  const linkClass = (href: string) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${pathname === href ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-semibold tracking-tight text-slate-900">
            Shopdee
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link href="/" className={linkClass("/")}>หน้าแรก</Link>
            <Link href="/products" className={linkClass("/products")}>สินค้า</Link>
            {session.type === "customer" && <Link href="/cart" className={linkClass("/cart")}>ตะกร้า</Link>}
            {session.type === "customer" && <Link href="/orders" className={linkClass("/orders")}>คำสั่งซื้อ</Link>}
            {session.type && <Link href="/profile" className={linkClass("/profile")}>โปรไฟล์</Link>}
            {session.type === "admin" && <Link href="/admin" className={linkClass("/admin")}>แดชบอร์ด</Link>}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session.type ? (
            <>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">{session.name}</span>
              <button onClick={onLogout} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                ออกจากระบบ
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
