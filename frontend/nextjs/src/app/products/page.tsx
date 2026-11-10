import ShopShell, { PageHeader } from "@/components/shop/ShopShell";
import ProductBrowser from "@/components/shop/ProductBrowser";
import { getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: Product[] = [];
  try {
    const result = await getProducts();
    products = Array.isArray(result) ? result : [];
  } catch {
    products = [];
  }

  return (
    <ShopShell>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Shopdee" title="สินค้าทั้งหมด" description="ค้นหา กรองตามหมวดหมู่และช่วงราคา แล้วกดดูรายละเอียดเพื่อเพิ่มลงตะกร้า" />
        <ProductBrowser products={products} title="รายการสินค้า" />
      </div>
    </ShopShell>
  );
}
