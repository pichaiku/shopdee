/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { getOrderStatuses, updateOrderStatus } from "@/lib/api";

interface OrdersTabProps {
  allOrders: any[];
  token: string;
  onVerifyOrder: (orderID: number) => void;
  onOrderUpdated?: () => void;
}

const statusColorMap: Record<number, string> = {
  1: "bg-blue-50 text-blue-700 border-blue-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-emerald-50 text-emerald-700 border-emerald-200",
  4: "bg-purple-50 text-purple-700 border-purple-200",
  5: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function OrdersTab({ allOrders, token, onVerifyOrder, onOrderUpdated }: OrdersTabProps) {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [updatingOrderID, setUpdatingOrderID] = useState<number | null>(null);

  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const data = await getOrderStatuses(token);
        if (Array.isArray(data)) {
          setStatuses(data);
        }
      } catch (err) {
        console.error("Failed to load order statuses:", err);
      }
    };
    loadStatuses();
  }, [token]);

  const handleStatusChange = async (orderID: number, newStatusID: number, currentStatusID: number) => {
    if (newStatusID === currentStatusID) return;

    const statusName = statuses.find((s) => s.statusID === newStatusID)?.statusName || `สถานะ ${newStatusID}`;
    if (!confirm(`ต้องการเปลี่ยนสถานะคำสั่งซื้อ #${orderID} เป็น "${statusName}" หรือไม่?`)) return;

    try {
      setUpdatingOrderID(orderID);
      const res = await updateOrderStatus(orderID, newStatusID, token);
      if (res.status) {
        alert(res.message || "อัปเดตสถานะเรียบร้อยแล้ว");
        onOrderUpdated?.();
      } else {
        alert(res.message || "เกิดข้อผิดพลาดในการอัปเดตสถานะ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setUpdatingOrderID(null);
    }
  };

  const getStatusColor = (statusID: number) => {
    return statusColorMap[statusID] || "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">รายการสั่งซื้อทั้งหมด</h2>
      <p className="text-slate-500 mb-6 text-sm">รายการประวัติคำสั่งซื้อทั้งหมดที่เกิดขึ้นในระบบ สามารถคลิกเปลี่ยนสถานะได้</p>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
        {allOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">ไม่มีรายการคำสั่งซื้อ</div>
        ) : (
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">เลขที่สั่งซื้อ</th>
                <th className="px-6 py-4">ลูกค้า</th>
                <th className="px-6 py-4">วันที่สั่งซื้อ</th>
                <th className="px-6 py-4 text-right">ยอดรวม</th>
                <th className="px-6 py-4">สถานะ</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allOrders.map((order) => (
                <tr key={order.orderID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">#{order.orderID}</td>
                  <td className="px-6 py-4">{order.firstName} {order.lastName}</td>
                  <td className="px-6 py-4 text-slate-500">{order.orderDate || "-"}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">฿{Number(order.totalPrice).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    {statuses.length > 0 ? (
                      <div className="relative inline-flex items-center">
                        <select
                          value={order.statusID}
                          onChange={(e) => handleStatusChange(order.orderID, Number(e.target.value), order.statusID)}
                          disabled={updatingOrderID === order.orderID}
                          className={`appearance-none cursor-pointer rounded-full px-3 py-1 text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-wait ${getStatusColor(order.statusID)}`}
                        >
                          {statuses.map((s) => (
                            <option key={s.statusID} value={s.statusID}>
                              {s.statusName}
                            </option>
                          ))}
                        </select>
                        {updatingOrderID === order.orderID && (
                          <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin ml-2" />
                        )}
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.statusID)}`}>
                        {order.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onVerifyOrder(order.orderID)}
                      className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-full cursor-pointer transition"
                    >
                      <Eye className="h-3.5 w-3.5" /> รายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
