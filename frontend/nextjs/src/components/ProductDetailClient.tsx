"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Minus, Plus, ShoppingCart, Check } from "lucide-react";
import type { Product } from "@/lib/types";
import { addToCart } from "@/lib/api";
import { getErrorMessage, getSession, notifyCartUpdated } from "@/lib/session";

export default function ProductDetailClient({ product }: { product: Product }) {
  const stock = Number(product.quantity);
  const outOfStock = stock <= 0;
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "login"; text: string } | null>(null);

  const clamp = (value: number) => Math.min(Math.max(1, Math.floor(value) || 1), Math.max(stock, 1));

  const handleAddToCart = async () => {
    const session = getSession();
    if (!session || session.user.type !== "customer") {
      setMessage({ tone: "login", text: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าก่อนเพิ่มสินค้าลงตะกร้า" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await addToCart(Number(session.user.id), product.productID, quantity, product.price, session.token);
      setMessage({ tone: "success", text: `เพิ่ม "${product.productName}" จำนวน ${quantity} ชิ้นลงตะกร้าแล้ว` });
      notifyCartUpdated();
    } catch (error: unknown) {
      setMessage({ tone: "error", text: getErrorMessage(error) || "เกิดข้อผิดพลาดขณะเพิ่มสินค้า" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">จำนวน</p>
          <p className={`text-xs ${outOfStock ? "text-rose-600" : stock <= 5 ? "text-amber-600" : "text-slate-500"}`}>
            {outOfStock ? "สินค้าหมดชั่วคราว" : `มีสินค้า ${stock.toLocaleString("th-TH")} ชิ้น`}
          </p>
        </div>
        <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
          <button type="button" aria-label="ลดจำนวน" onClick={() => setQuantity((q) => clamp(q - 1))} disabled={outOfStock || quantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-40">
            <Minus className="h-4 w-4" />
          </button>
          <input
            id="quantity"
            type="number"
            min={1}
            max={stock}
            value={quantity}
            disabled={outOfStock}
            onChange={(e) => setQuantity(clamp(Number(e.target.value)))}
            className="w-14 bg-transparent text-center font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setQuantity((q) => clamp(q + 1))} disabled={outOfStock || quantity >= stock} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-40">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button
        id="add-to-cart"
        onClick={handleAddToCart}
        disabled={loading || outOfStock}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
        {outOfStock ? "สินค้าหมด" : "เพิ่มลงตะกร้า"}
      </button>

      {message ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${
            message.tone === "success" ? "bg-emerald-50 text-emerald-700" : message.tone === "login" ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {message.tone === "success" ? <Check className="h-4 w-4" /> : null}
            {message.text}
          </span>
          {message.tone === "success" ? (
            <Link href="/cart" className="font-semibold underline underline-offset-2">ไปที่ตะกร้า</Link>
          ) : message.tone === "login" ? (
            <Link href="/login" className="font-semibold underline underline-offset-2">เข้าสู่ระบบ</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
