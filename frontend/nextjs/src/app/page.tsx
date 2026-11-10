import Link from "next/link";
import { ArrowRight, CreditCard, ShieldCheck, Sparkles, Truck } from "lucide-react";
import ShopShell from "@/components/shop/ShopShell";
import RecommendedSection from "@/components/shop/RecommendedSection";
import ProductBrowser from "@/components/shop/ProductBrowser";
import { getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadProducts(): Promise<Product[]> {
  try {
    const products = await getProducts();
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const products = await loadProducts();
  const typeCount = new Set(products.map((p) => p.typeName).filter(Boolean)).size;

  return (
    <ShopShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-rose-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              <Sparkles className="h-4 w-4" /> แนะนำสินค้าด้วย AI ตามสไตล์ของคุณ
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              ช้อปของดี <span className="bg-gradient-to-r from-brand-500 to-rose-500 bg-clip-text text-transparent">ราคาโดนใจ</span>
              <br className="hidden sm:block" /> ที่ Shopdee
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              เลือกซื้อสินค้าคุณภาพกว่า {products.length.toLocaleString("th-TH")} รายการ{typeCount ? ` จาก ${typeCount} หมวดหมู่` : ""} ชำระเงินง่ายด้วยบัตรเครดิตหรือโอนผ่านธนาคาร
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#all-products" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700">
                เริ่มช้อปเลย <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/register" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-3.5 font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50">
                สมัครสมาชิกฟรี
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Truck, title: "จัดส่งรวดเร็ว", text: "ติดตามสถานะได้ทุกขั้นตอน", tone: "bg-sky-50 text-sky-600" },
              { icon: CreditCard, title: "จ่ายด้วยบัตร", text: "Visa / Mastercard ผ่าน Omise", tone: "bg-violet-50 text-violet-600" },
              { icon: ShieldCheck, title: "ปลอดภัย 100%", text: "ไม่เก็บข้อมูลบัตรในระบบ", tone: "bg-emerald-50 text-emerald-600" },
              { icon: Sparkles, title: "แนะนำเฉพาะคุณ", text: "คัดสินค้าจากประวัติการซื้อ", tone: "bg-brand-50 text-brand-600" },
            ].map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <RecommendedSection />
        <div id="all-products" className="scroll-mt-24">
          {products.length > 0 ? (
            <ProductBrowser products={products} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">ไม่สามารถโหลดรายการสินค้าได้ในขณะนี้</div>
          )}
        </div>
      </div>
    </ShopShell>
  );
}
