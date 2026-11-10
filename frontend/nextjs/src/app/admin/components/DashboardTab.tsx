/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { Eye, TrendingUp, Users, Briefcase, Layers, Package, BarChart3, Calendar, Award } from "lucide-react";
import type { AdminOverview, SaleByPeriod, TopProduct } from "@/lib/types";

interface DashboardTabProps {
  overview: AdminOverview | null;
  salesYear: SaleByPeriod[];
  salesMonth: SaleByPeriod[];
  topProducts: TopProduct[];
  pendingOrders: any[];
  onVerifyOrder: (orderID: number) => void;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatCurrency(val: number) {
  return "฿" + Number(val || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactNumber(number: number) {
  if (number >= 1_000_000) return (number / 1_000_000).toFixed(1) + "M";
  if (number >= 1_000) return (number / 1_000).toFixed(1) + "k";
  return number.toString();
}

export default function DashboardTab({
  overview,
  salesYear,
  salesMonth,
  topProducts,
  pendingOrders,
  onVerifyOrder,
}: DashboardTabProps) {
  const [hoveredYearIndex, setHoveredYearIndex] = useState<number | null>(null);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [hoveredTopIndex, setHoveredTopIndex] = useState<number | null>(null);

  // Prepare Yearly Data
  const sortedSalesYear = [...salesYear].sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
  const maxYearSales = Math.max(...sortedSalesYear.map((d) => Number(d.totalSales) || 0), 1);

  // Prepare Monthly Data (12 months)
  const monthMap = new Map<number, number>();
  salesMonth.forEach((item) => {
    if (item.month) monthMap.set(Number(item.month), Number(item.totalSales) || 0);
  });
  const monthlyData = Array.from({ length: 12 }, (_, idx) => {
    const monthNum = idx + 1;
    return {
      month: monthNum,
      shortName: THAI_MONTHS_SHORT[idx],
      fullName: THAI_MONTHS_FULL[idx],
      totalSales: monthMap.get(monthNum) || 0,
    };
  });
  const maxMonthSales = Math.max(...monthlyData.map((d) => d.totalSales), 1);
  const totalMonthlySales = monthlyData.reduce((sum, d) => sum + d.totalSales, 0);

  // Prepare Top Products Data
  const sortedTopProducts = [...topProducts].slice(0, 5);
  const maxProductRevenue = Math.max(...sortedTopProducts.map((p) => Number(p.revenue) || 0), 1);
  const totalTopRevenue = sortedTopProducts.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);

  // SVG dimensions for Monthly Area/Line Chart
  const svgWidth = 540;
  const svgHeight = 220;
  const paddingX = 35;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const points = monthlyData.map((d, i) => {
    const x = paddingX + (i / 11) * chartWidth;
    const y = paddingTop + chartHeight - (d.totalSales / maxMonthSales) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const areaPath = `${linePath} L ${paddingX + chartWidth},${paddingTop + chartHeight} L ${paddingX},${paddingTop + chartHeight} Z`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider font-mono">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> แดชบอร์ดพนักงาน
            </div>
            <h1 className="text-3xl font-bold text-slate-900">สถิติและรายงานผลประกอบการ</h1>
            <p className="text-slate-500 text-sm">ภาพรวมข้อมูลระบบและกราฟวิเคราะห์ยอดขายแบบเรียลไทม์</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right">
              <p className="text-xs text-slate-500 font-medium">ยอดขายรวมปีปัจจุบัน</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalMonthlySales)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">ลูกค้าทั้งหมด</p>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{overview?.customerCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">บัญชีผู้ใช้งานในระบบ</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">พนักงาน</p>
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{overview?.employeeCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">เจ้าหน้าที่และแอดมิน</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">ประเภทสินค้า</p>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{overview?.typeCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">หมวดหมู่สินค้าทั้งหมด</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">สินค้าทั้งหมด</p>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{overview?.productCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">รายการสินค้าพร้อมขาย</p>
        </div>
      </div>

      {/* Graphs / Visual Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. Bar Chart: Yearly Sales */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">กราฟยอดขายรายปี</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">เปรียบเทียบรายปี</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">สถิติยอดจำหน่ายรวมของแต่ละปี</p>
          </div>

          {sortedSalesYear.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">ไม่มีข้อมูลยอดขายรายปี</div>
          ) : (
            <div className="space-y-4">
              {/* Vertical Column Chart */}
              <div className="h-52 w-full flex items-end justify-around gap-2 pt-6 pb-2 border-b border-slate-100">
                {sortedSalesYear.map((item, idx) => {
                  const sales = Number(item.totalSales) || 0;
                  const heightPercent = Math.max(Math.round((sales / maxYearSales) * 100), 8);
                  const isHovered = hoveredYearIndex === idx;

                  return (
                    <div
                      key={item.year ?? idx}
                      className="relative flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                      onMouseEnter={() => setHoveredYearIndex(idx)}
                      onMouseLeave={() => setHoveredYearIndex(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute -top-10 z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg animate-in fade-in zoom-in-95 duration-150">
                          {formatCurrency(sales)}
                        </div>
                      )}

                      {/* Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 ${
                          isHovered
                            ? "bg-gradient-to-t from-blue-600 to-indigo-500 shadow-md shadow-blue-200 scale-105"
                            : "bg-gradient-to-t from-slate-800 to-slate-600 hover:from-blue-700 hover:to-indigo-600"
                        }`}
                      />

                      {/* Label */}
                      <div className="mt-2 text-center">
                        <span className={`text-xs font-bold transition ${isHovered ? "text-blue-600" : "text-slate-700"}`}>
                          {item.year}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary List */}
              <div className="space-y-2 pt-2">
                {sortedSalesYear.map((item, idx) => (
                  <div
                    key={item.year ?? idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                      hoveredYearIndex === idx ? "bg-blue-50 text-blue-900 font-semibold" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      ปี {item.year}
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(Number(item.totalSales))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2. Area/Line Chart: Monthly Sales */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">กราฟยอดขายรายเดือน</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                12 เดือน
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">แนวโน้มยอดขายประจำเดือนตลอดทั้งปี</p>
          </div>

          <div className="space-y-3">
            {/* SVG Area & Line Graph */}
            <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-50/50 to-white p-2 border border-slate-100">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="monthlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="monthlyLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = paddingTop + chartHeight * (1 - ratio);
                  return (
                    <g key={i}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={paddingX + chartWidth}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingX - 6}
                        y={y + 3}
                        fontSize="9"
                        fill="#94a3b8"
                        textAnchor="end"
                        fontWeight="500"
                      >
                        {formatCompactNumber(maxMonthSales * ratio)}
                      </text>
                    </g>
                  );
                })}

                {/* Area Fill */}
                <path d={areaPath} fill="url(#monthlyAreaGrad)" />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#monthlyLineGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {points.map((pt, i) => {
                  const isHovered = hoveredMonthIndex === i;
                  return (
                    <g
                      key={i}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredMonthIndex(i)}
                      onMouseLeave={() => setHoveredMonthIndex(null)}
                    >
                      {/* Vertical Hover Guideline */}
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={paddingTop}
                          x2={pt.x}
                          y2={paddingTop + chartHeight}
                          stroke="#10b981"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Outer glow ring on hover */}
                      {isHovered && (
                        <circle cx={pt.x} cy={pt.y} r="8" fill="#10b981" opacity="0.25" />
                      )}

                      {/* Node Circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? "5" : pt.totalSales > 0 ? "3.5" : "2"}
                        fill={isHovered ? "#059669" : pt.totalSales > 0 ? "#10b981" : "#cbd5e1"}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all duration-200"
                      />

                      {/* X-Axis Month Text */}
                      <text
                        x={pt.x}
                        y={svgHeight - 8}
                        fontSize="9"
                        fill={isHovered ? "#0f172a" : "#64748b"}
                        fontWeight={isHovered ? "700" : "500"}
                        textAnchor="middle"
                      >
                        {pt.shortName}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Active Hover Detail Popup */}
              {hoveredMonthIndex !== null && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 border border-emerald-100 animate-in fade-in duration-150">
                  <span className="text-xs font-semibold text-emerald-900">
                    เดือน {monthlyData[hoveredMonthIndex].fullName}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {formatCurrency(monthlyData[hoveredMonthIndex].totalSales)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Stats Footer */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 text-xs">
              <span className="text-slate-500 font-medium">ยอดขายเฉลี่ยต่อเดือน</span>
              <span className="font-bold text-slate-900">{formatCurrency(totalMonthlySales / 12)}</span>
            </div>
          </div>
        </section>

        {/* 3. Horizontal Ranking Bar Chart: Top 5 Products */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Award className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">5 สินค้าขายดีที่สุด</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Top 5
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">จัดอันดับตามยอดขายรวม (รายได้)</p>
          </div>

          {sortedTopProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">ไม่มีข้อมูลสินค้าขายดี</div>
          ) : (
            <div className="space-y-3.5">
              {sortedTopProducts.map((item, idx) => {
                const revenue = Number(item.revenue) || 0;
                const percent = Math.max(Math.round((revenue / maxProductRevenue) * 100), 6);
                const sharePercent = totalTopRevenue > 0 ? ((revenue / totalTopRevenue) * 100).toFixed(1) : "0";
                const isHovered = hoveredTopIndex === idx;

                const rankColors = [
                  "bg-amber-500 text-white shadow-amber-200", // Rank 1 (Gold)
                  "bg-slate-400 text-white shadow-slate-200", // Rank 2 (Silver)
                  "bg-orange-400 text-white shadow-orange-200", // Rank 3 (Bronze)
                  "bg-slate-200 text-slate-700", // Rank 4
                  "bg-slate-100 text-slate-600", // Rank 5
                ];

                const barGradients = [
                  "from-amber-500 to-yellow-400",
                  "from-blue-600 to-indigo-500",
                  "from-emerald-500 to-teal-400",
                  "from-purple-500 to-indigo-400",
                  "from-slate-700 to-slate-500",
                ];

                return (
                  <div
                    key={item.productID || idx}
                    className={`p-2.5 rounded-2xl transition duration-200 cursor-pointer ${
                      isHovered ? "bg-slate-50 scale-[1.02]" : "hover:bg-slate-50/60"
                    }`}
                    onMouseEnter={() => setHoveredTopIndex(idx)}
                    onMouseLeave={() => setHoveredTopIndex(null)}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-xs shrink-0 ${rankColors[idx] || rankColors[3]}`}>
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 truncate" title={item.productName}>
                          {item.productName}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(revenue)}
                      </span>
                    </div>

                    {/* Progress Track & Bar */}
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex items-center">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${barGradients[idx] || barGradients[4]}`}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                      <span>สัดส่วนในกลุ่ม Top 5</span>
                      <span className="font-medium text-slate-600">{sharePercent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Pending Payment Verification (ยกเว้นส่วนนี้ ไม่ต้องแก้ไข) */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">รายการคำสั่งซื้อรอตรวจสอบการชำระเงิน ({pendingOrders.length})</h2>
        <p className="mt-1 text-sm text-slate-500">คำสั่งซื้อที่รอเจ้าหน้าที่ตรวจสอบสลิปและยืนยันยอดเงิน (สถานะ: กำลังตรวจสอบการชำระ)</p>
        
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white">
          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              ไม่มีคำสั่งซื้อที่รอตรวจสอบการชำระเงินในขณะนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">เลขที่คำสั่งซื้อ</th>
                    <th className="px-6 py-4">ลูกค้า</th>
                    <th className="px-6 py-4">วันที่สั่งซื้อ</th>
                    <th className="px-6 py-4 text-right">ยอดรวม</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pendingOrders.map((order) => (
                    <tr key={order.orderID} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">#{order.orderID}</td>
                      <td className="px-6 py-4">{order.firstName} {order.lastName}</td>
                      <td className="px-6 py-4 text-slate-500">{order.orderDate}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">฿{Number(order.totalPrice).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => onVerifyOrder(order.orderID)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> ตรวจสอบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
