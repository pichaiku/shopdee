"use client";

import { useMemo, useState } from "react";
import { PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

type Sort = "default" | "price-asc" | "price-desc" | "name";

export default function ProductBrowser({ products, title = "สินค้าทั้งหมด" }: { products: Product[]; title?: string }) {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("default");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [range, setRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [inStockOnly, setInStockOnly] = useState(false);

  const types = useMemo(() => {
    const names = new Set<string>();
    products.forEach((p) => p.typeName && names.add(p.typeName));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "th"));
  }, [products]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list = products.filter((p) => {
      if (type !== "all" && p.typeName !== type) return false;
      if (kw && !`${p.productName} ${p.productDetail ?? ""} ${p.typeName ?? ""}`.toLowerCase().includes(kw)) return false;
      const price = Number(p.price);
      if (range.min !== null && price < range.min) return false;
      if (range.max !== null && price > range.max) return false;
      if (inStockOnly && Number(p.quantity) <= 0) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "name") sorted.sort((a, b) => a.productName.localeCompare(b.productName, "th"));
    return sorted;
  }, [products, keyword, type, range, inStockOnly, sort]);

  const applyPrice = () => {
    const min = minInput === "" ? null : Number(minInput);
    const max = maxInput === "" ? null : Number(maxInput);
    setRange({ min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null });
  };

  const hasFilters = keyword || type !== "all" || range.min !== null || range.max !== null || inStockOnly;
  const reset = () => {
    setKeyword("");
    setType("all");
    setMinInput("");
    setMaxInput("");
    setRange({ min: null, max: null });
    setInStockOnly(false);
    setSort("default");
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
    }`;

  return (
    <section className="space-y-6" aria-labelledby="all-products-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="all-products-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-slate-500">พบ {filtered.length.toLocaleString("th-TH")} รายการ</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="search-kw"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:w-64"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="เรียงลำดับ"
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          >
            <option value="default">เรียงตาม: แนะนำ</option>
            <option value="price-asc">ราคา: ต่ำ → สูง</option>
            <option value="price-desc">ราคา: สูง → ต่ำ</option>
            <option value="name">ชื่อสินค้า</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <button onClick={() => setType("all")} className={chip(type === "all")}>
            ทั้งหมด
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setType(t)} className={chip(type === t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <input id="price-min" type="number" min={0} value={minInput} onChange={(e) => setMinInput(e.target.value)} placeholder="ราคาต่ำสุด" className="w-28 rounded-full border border-slate-200 px-3 py-1.5 outline-none focus:border-brand-400" />
          <span className="text-slate-400">–</span>
          <input id="price-max" type="number" min={0} value={maxInput} onChange={(e) => setMaxInput(e.target.value)} placeholder="ราคาสูงสุด" className="w-28 rounded-full border border-slate-200 px-3 py-1.5 outline-none focus:border-brand-400" />
          <button id="apply-filter" onClick={applyPrice} className="rounded-full bg-brand-600 px-4 py-1.5 font-semibold text-white transition hover:bg-brand-700">
            กรอง
          </button>
          <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-slate-600">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            มีสินค้า
          </label>
          {hasFilters ? (
            <button onClick={reset} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-slate-500 hover:bg-slate-100">
              <X className="h-3.5 w-3.5" /> ล้างตัวกรอง
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <PackageSearch className="h-12 w-12 text-slate-300" />
          <p className="font-semibold text-slate-700">ไม่พบสินค้าที่ค้นหา</p>
          <p className="text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง</p>
          {hasFilters ? (
            <button onClick={reset} className="mt-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              ล้างตัวกรอง
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => (
            <ProductCard key={product.productID} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
