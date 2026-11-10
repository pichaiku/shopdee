"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin, Phone, Receipt, Upload } from "lucide-react";
import ShopShell, { Notice } from "@/components/shop/ShopShell";
import CardPaymentForm from "@/components/shop/CardPaymentForm";
import { StatusBadge, StatusTimeline } from "@/components/shop/OrderStatus";
import { getOrderInfo, getOrderDetails, submitPayment } from "@/lib/api";
import type { OrderDetail, OrderInfo } from "@/lib/types";
import { formatBaht, getCustomerSession, getErrorMessage } from "@/lib/session";

type Method = "card" | "slip";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>("card");
  const [success, setSuccess] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const session = getCustomerSession();
    if (!session) {
      setMessage("กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดคำสั่งซื้อ");
      setLoading(false);
      return;
    }
    try {
      const [orderInfo, orderDetails] = await Promise.all([
        getOrderInfo(Number(session.user.id), Number(id), session.token),
        getOrderDetails(Number(session.user.id), Number(id), session.token),
      ]);
      setOrder(orderInfo[0] ?? null);
      setDetails(orderDetails);
      if (!orderInfo[0]) setMessage("ไม่พบคำสั่งซื้อนี้");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const onPaid = async (text: string) => {
    setSuccess(text);
    await loadOrder();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const total = Number(order?.totalPrice ?? 0);

  return (
    <ShopShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> คำสั่งซื้อทั้งหมด
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">คำสั่งซื้อ #{id}</h1>
            {order?.orderDate ? <p className="mt-1 text-sm text-slate-500">สั่งซื้อเมื่อ {order.orderDate}</p> : null}
          </div>
          {order ? <StatusBadge statusID={order.statusID} statusName={order.statusName} /> : null}
        </div>

        {success ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <p className="font-medium">{success}</p>
          </div>
        ) : null}
        {message ? <Notice>{message}</Notice> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดข้อมูล...
          </div>
        ) : order ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <StatusTimeline statusID={order.statusID} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
              <div className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h2 className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">รายการสินค้า ({details.length})</h2>
                  <ul className="divide-y divide-slate-100">
                    {details.map((item) => (
                      <li key={`${item.orderID}-${item.productID}`} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                          <Link href={`/products/${item.productID}`} className="font-medium text-slate-900 hover:text-brand-700">{item.productName}</Link>
                          <p className="text-sm text-slate-500">{formatBaht(item.price)} × {item.quantity}</p>
                        </div>
                        <p className="shrink-0 font-semibold text-slate-900">{formatBaht(Number(item.price) * Number(item.quantity))}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between bg-slate-50 px-6 py-4">
                    <span className="font-medium text-slate-600">ยอดรวมทั้งสิ้น</span>
                    <span className="text-xl font-bold text-slate-900">{formatBaht(total)}</span>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-slate-900">ที่อยู่จัดส่ง</h2>
                  <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{order.firstName} {order.lastName}</p>
                    <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{order.address || "ยังไม่ได้ระบุที่อยู่"}</p>
                    {order.mobilePhone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{order.mobilePhone}</p> : null}
                  </div>
                </section>
              </div>

              <aside className="h-fit lg:sticky lg:top-24">
                {Number(order.statusID) === 1 ? (
                  <section id="payment" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">ชำระเงิน</h2>
                      <p className="text-sm text-slate-500">ยอดที่ต้องชำระ <span className="font-semibold text-slate-900">{formatBaht(total)}</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1">
                      {(
                        [
                          { key: "card", label: "บัตรเครดิต", icon: CreditCard },
                          { key: "slip", label: "โอน / แนบสลิป", icon: Receipt },
                        ] as const
                      ).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMethod(key)}
                          className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${method === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          <Icon className="h-4 w-4" /> {label}
                        </button>
                      ))}
                    </div>
                    {method === "card" ? (
                      <CardPaymentForm orderID={order.orderID} amount={total} onPaid={() => onPaid("ชำระเงินด้วยบัตรเครดิตสำเร็จ ขอบคุณที่ใช้บริการ")} />
                    ) : (
                      <SlipUploadForm orderID={order.orderID} amount={total} onUploaded={() => onPaid("ส่งสลิปเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบการชำระเงิน")} />
                    )}
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <p className="mt-3 font-semibold text-slate-900">
                      {Number(order.statusID) === 2 ? "ได้รับสลิปแล้ว กำลังตรวจสอบ" : "ชำระเงินเรียบร้อยแล้ว"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">เราจะแจ้งสถานะการจัดส่งให้ทราบที่หน้านี้</p>
                    <Link href="/" className="mt-5 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
                      เลือกซื้อสินค้าต่อ
                    </Link>
                  </section>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </ShopShell>
  );
}

function SlipUploadForm({ orderID, amount, onUploaded }: { orderID: number; amount: number; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    if (f.size > 5 * 1024 * 1024) return setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    const session = getCustomerSession();
    if (!session || !file) return setError("กรุณาเข้าสู่ระบบและเลือกไฟล์สลิปก่อน");
    setUploading(true);
    setError(null);
    try {
      await submitPayment(Number(session.user.id), orderID, amount, file, session.token);
      onUploaded();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "เกิดข้อผิดพลาดในการส่งสลิป");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p>โอนเงินจำนวน <span className="font-semibold text-slate-900">{formatBaht(amount)}</span> ผ่านแอปธนาคาร แล้วแนบรูปสลิปด้านล่าง</p>
      </div>
      <label
        htmlFor="slip-file"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          choose(e.dataTransfer.files?.[0] ?? null);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="ตัวอย่างสลิป" className="max-h-72 rounded-lg object-contain" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="font-medium text-slate-700">คลิกหรือลากไฟล์สลิปมาวาง</span>
            <span className="text-xs text-slate-400">JPG / PNG ไม่เกิน 5 MB</span>
          </>
        )}
        <input id="slip-file" type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </label>
      {file ? <p className="truncate text-center text-xs text-slate-500">{file.name}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}
      <button
        onClick={upload}
        disabled={uploading || !file}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3.5 font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "กำลังอัปโหลด..." : "ส่งสลิป"}
      </button>
    </div>
  );
}
