"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ImageOff, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import ShopShell, { Notice, PageHeader } from "@/components/shop/ShopShell";
import { getCart, getCartProducts, updateCartProduct, removeCartProduct, confirmOrder, productImageUrl } from "@/lib/api";
import type { CartProduct, CartSummary } from "@/lib/types";
import { formatBaht, getCustomerSession, getErrorMessage, notifyCartUpdated } from "@/lib/session";

export default function CartPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [items, setItems] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    const session = getCustomerSession();
    if (!session) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }
    try {
      const [cart, products] = await Promise.all([
        getCart(Number(session.user.id), session.token),
        getCartProducts(Number(session.user.id), session.token),
      ]);
      setSummary(cart[0] ?? null);
      setItems(products);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถโหลดตะกร้าได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const handleQuantity = async (productID: number, newQuantity: number) => {
    const session = getCustomerSession();
    if (!session || newQuantity < 1) return;
    setBusyItem(productID);
    setMessage(null);
    try {
      await updateCartProduct(Number(session.user.id), productID, newQuantity, session.token);
      await loadCart();
      notifyCartUpdated();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถอัปเดตจำนวนสินค้าได้");
    } finally {
      setBusyItem(null);
    }
  };

  const handleRemove = async (item: CartProduct) => {
    const session = getCustomerSession();
    if (!session) return;
    setBusyItem(item.productID);
    setMessage(null);
    try {
      await removeCartProduct(Number(session.user.id), item.orderID, item.productID, session.token);
      await loadCart();
      notifyCartUpdated();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถลบสินค้าจากตะกร้าได้");
    } finally {
      setBusyItem(null);
    }
  };

  const handleConfirm = async () => {
    const session = getCustomerSession();
    if (!session || !summary) return;
    setConfirming(true);
    setMessage(null);
    try {
      await confirmOrder(Number(session.user.id), summary.orderID, session.token);
      notifyCartUpdated();
      router.push(`/orders/${summary.orderID}?pay=1`);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถยืนยันคำสั่งซื้อได้");
      setConfirming(false);
    }
  };

  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);

  return (
    <ShopShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="ตะกร้าสินค้า" title="ตะกร้าของฉัน" description="ตรวจสอบรายการ ปรับจำนวน แล้วยืนยันการสั่งซื้อเพื่อไปยังขั้นตอนชำระเงิน" />

        {message ? <Notice id="error-banner">{message}</Notice> : null}

        {!loggedIn ? (
          <EmptyState title="กรุณาเข้าสู่ระบบ" text="เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อดูตะกร้าสินค้าของคุณ" href="/login" cta="เข้าสู่ระบบ" />
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดตะกร้า...
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="ตะกร้าของคุณยังว่างอยู่" text="เลือกสินค้าที่ชอบแล้วกดเพิ่มลงตะกร้าได้เลย" href="/" cta="เลือกซื้อสินค้า" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <ul className="h-fit divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {items.map((item) => {
                const image = productImageUrl(item.imageFile);
                const busy = busyItem === item.productID;
                return (
                  <li key={`${item.orderID}-${item.productID}`} className={`flex gap-4 p-4 sm:p-5 ${busy ? "opacity-60" : ""}`}>
                    <Link href={`/products/${item.productID}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={item.productName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-300"><ImageOff className="h-6 w-6" /></div>
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/products/${item.productID}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700">
                            {item.productName}
                          </Link>
                          <p className="mt-0.5 text-sm text-slate-500">{formatBaht(item.price)} / ชิ้น</p>
                        </div>
                        <button onClick={() => handleRemove(item)} disabled={busy} aria-label="ลบสินค้า" className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
                          <button onClick={() => handleQuantity(item.productID, Number(item.quantity) - 1)} disabled={busy || Number(item.quantity) <= 1} aria-label="ลดจำนวน" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-white disabled:opacity-40">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            id="cart-qty"
                            type="number"
                            min={1}
                            defaultValue={item.quantity}
                            key={item.quantity}
                            onBlur={(e) => {
                              const v = Math.floor(Number(e.target.value));
                              if (v >= 1 && v !== Number(item.quantity)) handleQuantity(item.productID, v);
                            }}
                            className="w-12 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={() => handleQuantity(item.productID, Number(item.quantity) + 1)} disabled={busy} aria-label="เพิ่มจำนวน" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-white disabled:opacity-40">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="font-bold text-slate-900">{formatBaht(Number(item.price) * Number(item.quantity))}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-slate-900">สรุปคำสั่งซื้อ</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>จำนวนสินค้า</dt>
                  <dd>{totalQty.toLocaleString("th-TH")} ชิ้น</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd id="subtotal">{formatBaht(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>ค่าจัดส่ง</dt>
                  <dd className="font-medium text-emerald-600">ฟรี</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                  <dt>ยอดชำระทั้งหมด</dt>
                  <dd>{formatBaht(summary?.totalPrice ?? subtotal)}</dd>
                </div>
              </dl>
              {summary ? (
                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  <p className="font-medium text-slate-700">จัดส่งถึง: {summary.firstName} {summary.lastName}</p>
                  {summary.address ? <p>{summary.address}</p> : <p className="text-amber-600">ยังไม่ได้ระบุที่อยู่ — <Link href="/profile" className="underline">เพิ่มที่อยู่</Link></p>}
                  {summary.mobilePhone ? <p>โทร {summary.mobilePhone}</p> : null}
                </div>
              ) : null}
              <button
                id="checkout-btn"
                onClick={handleConfirm}
                disabled={confirming || !summary}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:bg-slate-300 disabled:shadow-none"
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                ยืนยันการสั่งซื้อและชำระเงิน
                {!confirming ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
              <Link href="/" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-900">
                เลือกซื้อสินค้าต่อ
              </Link>
            </aside>
          </div>
        )}
      </div>
    </ShopShell>
  );
}

function EmptyState({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <ShoppingCart className="h-7 w-7" />
      </span>
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500">{text}</p>
      <Link href={href} className="mt-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
        {cta}
      </Link>
    </div>
  );
}
