"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, PackageOpen } from "lucide-react";
import ShopShell, { Notice, PageHeader } from "@/components/shop/ShopShell";
import { StatusBadge } from "@/components/shop/OrderStatus";
import { getHistory } from "@/lib/api";
import type { OrderSummary } from "@/lib/types";
import { formatBaht, getCustomerSession, getErrorMessage } from "@/lib/session";

const STATUS_FILTERS = [
  { id: 0, label: "ทั้งหมด" },
  { id: 1, label: "รอชำระเงิน" },
  { id: 2, label: "ตรวจสอบการชำระ" },
  { id: 3, label: "ชำระแล้ว" },
  { id: 4, label: "กำลังจัดส่ง" },
  { id: 5, label: "ส่งสำเร็จ" },
];

export default function OrdersPage() {
  const thisYear = new Date().getFullYear();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [year, setYear] = useState<string>("all");
  const [status, setStatus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      const session = getCustomerSession();
      if (!session) {
        setMessage("กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getHistory(Number(session.user.id), session.token, year === "all" ? undefined : year);
        setOrders(Array.isArray(data) ? data : []);
        setMessage(null);
      } catch (error: unknown) {
        setMessage(getErrorMessage(error) || "ไม่สามารถโหลดคำสั่งซื้อได้");
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [year]);

  const visible = status === 0 ? orders : orders.filter((o) => Number(o.statusID) === status);
  const pendingCount = orders.filter((o) => Number(o.statusID) === 1).length;

  return (
    <ShopShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="ประวัติคำสั่งซื้อ" title="คำสั่งซื้อของฉัน" description="ติดตามสถานะ ชำระเงิน และดูรายละเอียดคำสั่งซื้อทั้งหมดของคุณ">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="เลือกปี"
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          >
            <option value="all">ทุกปี</option>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={String(y)}>ปี {y}</option>
            ))}
          </select>
        </PageHeader>

        {pendingCount > 0 ? (
          <Notice tone="info">คุณมี {pendingCount} คำสั่งซื้อที่รอชำระเงิน — กดที่คำสั่งซื้อเพื่อชำระด้วยบัตรเครดิตหรือแนบสลิป</Notice>
        ) : null}
        {message ? <Notice>{message}</Notice> : null}

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                status === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลด...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <PackageOpen className="h-12 w-12 text-slate-300" />
            <p className="font-semibold text-slate-700">ยังไม่มีคำสั่งซื้อ</p>
            <Link href="/" className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              เริ่มช้อปเลย
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((order) => (
              <li key={order.orderID}>
                <Link
                  id="order-link"
                  href={`/orders/${order.orderID}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">คำสั่งซื้อ #{order.orderID}</p>
                      <StatusBadge statusID={order.statusID} statusName={order.statusName} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.orderDate ? `สั่งซื้อ ${order.orderDate}` : "ไม่ระบุวันที่"} · {Number(order.totalQuantity).toLocaleString("th-TH")} ชิ้น
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatBaht(order.totalPrice)}</p>
                    {Number(order.statusID) === 1 ? <p className="text-xs font-semibold text-brand-600">ชำระเงิน →</p> : null}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ShopShell>
  );
}
