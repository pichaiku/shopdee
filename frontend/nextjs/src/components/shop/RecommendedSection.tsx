"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Sparkles } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { RecommendedProduct } from "@/lib/types";
import { getCustomerSession } from "@/lib/session";

/**
 * Top 10 for the visitor:
 *  - logged-in customer with purchase history -> ML recommendations first
 *  - anything missing (or a guest)            -> filled with best sellers
 */
export default function RecommendedSection() {
  const [items, setItems] = useState<RecommendedProduct[] | null>(null);
  const [recommendedCount, setRecommendedCount] = useState(0);
  const [isCustomer, setIsCustomer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getCustomerSession();
    setIsCustomer(Boolean(session));
    const query = session ? `?custID=${encodeURIComponent(String(session.user.id))}` : "";
    fetch(`/api/recommendations${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [], recommendedCount: 0 }))
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setRecommendedCount(Number(data.recommendedCount) || 0);
      })
      .catch(() => setItems([]));
  }, []);

  if (items && items.length === 0) return null;

  const personalized = recommendedCount > 0;
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });
  let popularRank = 0;

  return (
    <section className="space-y-5" aria-labelledby="recommended-title">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${personalized ? "text-violet-600" : "text-brand-600"}`}>
            {personalized ? <Sparkles className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
            {personalized ? "คัดมาเพื่อคุณโดยเฉพาะ" : "ยอดนิยม"}
          </p>
          <h2 id="recommended-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {personalized ? "สินค้าแนะนำสำหรับคุณ" : "สินค้าขายดี 10 อันดับ"}
          </h2>
          <p className="text-sm text-slate-500">
            {personalized
              ? `จากพฤติกรรมการซื้อของคุณ ${recommendedCount} รายการ${recommendedCount < 10 ? " และสินค้าขายดีอื่น ๆ" : ""}`
              : isCustomer
                ? "สั่งซื้อสินค้าเพิ่มเพื่อรับคำแนะนำที่ตรงใจยิ่งขึ้น"
                : "เข้าสู่ระบบเพื่อรับคำแนะนำสินค้าที่เหมาะกับคุณ"}
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scrollBy(-1)} aria-label="เลื่อนซ้าย" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => scrollBy(1)} aria-label="เลื่อนขวา" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {items === null
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[46%] shrink-0 animate-pulse sm:w-[30%] lg:w-[19%]">
                <div className="aspect-square rounded-2xl bg-slate-200" />
                <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-1/3 rounded bg-slate-200" />
              </div>
            ))
          : items.map((product) => {
              if (product.source === "popular") popularRank += 1;
              return (
                <div key={product.productID} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[19%]">
                  <ProductCard product={product} badge={product.source} rank={product.source === "popular" ? popularRank : undefined} />
                </div>
              );
            })}
      </div>
    </section>
  );
}
