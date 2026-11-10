"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Menu, Package, ShoppingBag, ShoppingCart, User, X, LayoutDashboard } from "lucide-react";
import { getCart } from "@/lib/api";
import { CART_UPDATED_EVENT, getSession, type StoredSession } from "@/lib/session";

export default function ShopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredSession | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshCart = useCallback(async () => {
    const session = getSession();
    if (!session || session.user.type !== "customer") {
      setCartCount(0);
      return;
    }
    try {
      const cart = await getCart(Number(session.user.id), session.token);
      setCartCount(Number(cart[0]?.totalQuantity ?? 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    setUser(getSession()?.user ?? null);
    refreshCart();
    window.addEventListener(CART_UPDATED_EVENT, refreshCart);
    return () => window.removeEventListener(CART_UPDATED_EVENT, refreshCart);
  }, [refreshCart]);

  useEffect(() => setOpen(false), [pathname]);

  const onLogout = () => {
    localStorage.removeItem("shopdee_token");
    localStorage.removeItem("shopdee_user");
    setUser(null);
    router.push("/login");
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const linkClass = (href: string) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const links = [
    { href: "/", label: "หน้าแรก", icon: ShoppingBag, show: true },
    { href: "/products", label: "สินค้าทั้งหมด", icon: Package, show: true },
    { href: "/orders", label: "คำสั่งซื้อของฉัน", icon: Package, show: user?.type === "customer" },
    { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard, show: user?.type === "admin" },
  ].filter((l) => l.show);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-rose-500 text-white shadow-md shadow-brand-500/30">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Shop<span className="text-brand-600">dee</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user?.type === "customer" && (
            <Link
              href="/cart"
              aria-label="ตะกร้าสินค้า"
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                isActive("/cart") ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/profile"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isActive("/profile") ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <User className="h-4 w-4" />
                </span>
                {user.firstName ?? user.username}
              </Link>
              <button
                onClick={onLogout}
                title="ออกจากระบบ"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/register" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                สมัครสมาชิก
              </Link>
              <Link href="/login" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                เข้าสู่ระบบ
              </Link>
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="เมนู"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/profile" className={linkClass("/profile")}>
                  <User className="h-4 w-4" />
                  โปรไฟล์ ({user.firstName ?? user.username})
                </Link>
                <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/register" className="rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700">
                  สมัครสมาชิก
                </Link>
                <Link href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white">
                  เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
