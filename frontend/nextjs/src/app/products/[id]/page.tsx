import Link from "next/link";
import { ChevronRight, ImageOff, PackageX } from "lucide-react";
import ShopShell from "@/components/shop/ShopShell";
import ProductDetailClient from "@/components/ProductDetailClient";
import { getProduct, productImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product: Product | null = null;
  try {
    product = await getProduct(id);
  } catch {
    product = null;
  }

  if (!product) {
    return (
      <ShopShell>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
          <PackageX className="h-14 w-14 text-slate-300" />
          <h1 className="text-2xl font-bold text-slate-900">ไม่พบสินค้านี้</h1>
          <p className="text-slate-500">สินค้าอาจถูกลบหรือไม่มีอยู่ในระบบแล้ว</p>
          <Link href="/products" className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700">
            กลับไปหน้าสินค้า
          </Link>
        </div>
      </ShopShell>
    );
  }

  const image = productImageUrl(product.imageFile);

  return (
    <ShopShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-1 text-sm text-slate-500" aria-label="breadcrumb">
          <Link href="/" className="hover:text-slate-900">หน้าแรก</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/products" className="hover:text-slate-900">สินค้า</Link>
          {product.typeName ? (
            <>
              <ChevronRight className="h-4 w-4" />
              <span>{product.typeName}</span>
            </>
          ) : null}
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={product.productName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <ImageOff className="h-16 w-16" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              {product.typeName ? (
                <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{product.typeName}</span>
              ) : null}
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{product.productName}</h1>
              <p className="text-3xl font-bold text-brand-600">
                ฿{Number(product.price).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <ProductDetailClient product={product} />

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">รายละเอียดสินค้า</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{product.productDetail || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
                <div>
                  <dt className="text-slate-500">รหัสสินค้า</dt>
                  <dd className="mt-1 font-medium text-slate-900">#{product.productID}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">คงเหลือในคลัง</dt>
                  <dd className="mt-1 font-medium text-slate-900">{Number(product.quantity).toLocaleString("th-TH")} ชิ้น</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </ShopShell>
  );
}
