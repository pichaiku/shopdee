import type { Product } from "@/lib/types";
import Link from "next/link";
import { ImageOff, Sparkles, Flame } from "lucide-react";
import { productImageUrl } from "@/lib/api";

type Badge = "recommended" | "popular" | null;

export default function ProductCard({ product, badge = null, rank }: { product: Product; badge?: Badge; rank?: number }) {
  const outOfStock = Number(product.quantity) <= 0;
  const lowStock = !outOfStock && Number(product.quantity) <= 5;
  const image = productImageUrl(product.imageFile);

  return (
    <Link
      href={`/products/${product.productID}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/10"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.productName}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${outOfStock ? "opacity-60 grayscale" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {badge === "recommended" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/95 px-2.5 py-1 text-xs font-semibold text-white shadow">
              <Sparkles className="h-3.5 w-3.5" /> แนะนำสำหรับคุณ
            </span>
          )}
          {badge === "popular" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/95 px-2.5 py-1 text-xs font-semibold text-white shadow">
              <Flame className="h-3.5 w-3.5" /> ขายดี{rank ? ` #${rank}` : ""}
            </span>
          )}
        </div>

        {outOfStock && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-slate-900/80 py-1 text-center text-xs font-semibold text-white">สินค้าหมด</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.typeName ? <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{product.typeName}</span> : null}
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{product.productName}</h3>
        {product.productDetail ? <p className="line-clamp-2 text-sm text-slate-500">{product.productDetail}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-lg font-bold text-slate-900">
            ฿{Number(product.price).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {product.totalSold ? (
            <span className="text-xs text-slate-500">ขายแล้ว {Number(product.totalSold).toLocaleString("th-TH")}</span>
          ) : lowStock ? (
            <span className="text-xs font-medium text-amber-600">เหลือ {product.quantity} ชิ้น</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
