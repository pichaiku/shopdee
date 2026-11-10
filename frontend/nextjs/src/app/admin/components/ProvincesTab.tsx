/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { getProvinces, createProvince, updateProvince, deleteProvince } from "@/lib/api";

interface ProvincesTabProps {
  token: string;
}

export default function ProvincesTab({ token }: ProvincesTabProps) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [provinceID, setProvinceID] = useState("");
  const [provinceName, setProvinceName] = useState("");

  const loadProvinces = async () => {
    try {
      setLoading(true);
      const data = await getProvinces();
      setProvinces(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลจังหวัดได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setProvinceID("");
    setProvinceName("");
    setIsOpen(true);
  };

  const handleOpenEdit = (prov: any) => {
    setIsEdit(true);
    setProvinceID(prov.provinceID);
    setProvinceName(prov.provinceName || "");
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`คุณต้องการลบจังหวัดรหัส ${id} หรือไม่?`)) return;
    try {
      const res = await deleteProvince(id, token);
      if (res.status) {
        alert(res.message);
        loadProvinces();
      } else {
        alert(res.message || "ลบไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถลบได้เนื่องจากมีข้อมูลอำเภอ/ตำบลผูกอยู่กับจังหวัดนี้");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provinceID || !provinceName) return;
    if (!isEdit && (provinceID.length !== 2 || isNaN(Number(provinceID)))) {
      alert("รหัสจังหวัดต้องเป็นตัวเลข 2 หลัก (เช่น 81, 90)");
      return;
    }

    try {
      let res;
      if (isEdit) {
        res = await updateProvince(provinceID, { provinceName }, token);
      } else {
        res = await createProvince({ provinceID, provinceName }, token);
      }
      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        loadProvinces();
      } else {
        alert(res.message || "บันทึกผิดพลาด");
      }
    } catch (err: any) {
      alert(err.message || "บันทึกผิดพลาด");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ข้อมูลจังหวัด (Provinces)</h2>
          <p className="text-slate-500 text-sm font-sans">จัดการรายชื่อจังหวัดที่ระบบรองรับการจัดส่งสินค้า</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มจังหวัด
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white max-h-[450px] overflow-y-auto pr-1">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-6 py-4">รหัสจังหวัด</th>
                <th className="px-6 py-4">ชื่อจังหวัด</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {provinces.map((prov) => (
                <tr key={prov.provinceID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-mono font-semibold text-slate-900">#{prov.provinceID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{prov.provinceName}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(prov)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(prov.provinceID)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 cursor-pointer transition"
                    >
                      <Trash2 className="h-3 w-3" /> ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? "แก้ไขชื่อจังหวัด" : "เพิ่มจังหวัดใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">รหัสจังหวัด (ตัวเลข 2 หลัก) *</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  disabled={isEdit}
                  value={provinceID}
                  onChange={(e) => setProvinceID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  placeholder="เช่น 81"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อจังหวัด *</label>
                <input
                  type="text"
                  required
                  value={provinceName}
                  onChange={(e) => setProvinceName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="เช่น กระบี่"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-5 py-2 text-white hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
