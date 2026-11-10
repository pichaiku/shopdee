/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { getPositions, createPosition, updatePosition, deletePosition } from "@/lib/api";

interface PositionsTabProps {
  token: string;
}

export default function PositionsTab({ token }: PositionsTabProps) {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedPositionID, setSelectedPositionID] = useState<number | null>(null);
  const [positionName, setPositionName] = useState("");

  const loadPositions = async () => {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลตำแหน่งได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSelectedPositionID(null);
    setPositionName("");
    setIsOpen(true);
  };

  const handleOpenEdit = (pos: any) => {
    setIsEdit(true);
    setSelectedPositionID(pos.positionID);
    setPositionName(pos.positionName || "");
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("คุณต้องการลบตำแหน่งงานนี้หรือไม่?")) return;
    try {
      const res = await deletePosition(id, token);
      if (res.status) {
        alert(res.message);
        loadPositions();
      } else {
        alert(res.message || "ลบไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถลบได้เนื่องจากพนักงานกำลังใช้งานตำแหน่งนี้อยู่");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionName) return;
    try {
      let res;
      if (isEdit && selectedPositionID) {
        res = await updatePosition(selectedPositionID, { positionName }, token);
      } else {
        res = await createPosition({ positionName }, token);
      }
      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        loadPositions();
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
          <h2 className="text-2xl font-bold text-slate-900">ตำแหน่งงาน (Positions)</h2>
          <p className="text-slate-500 text-sm">จัดการตำแหน่งหน้าที่และสิทธิ์การเข้าใช้ระบบของพนักงาน</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มตำแหน่ง
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">รหัสตำแหน่ง</th>
                <th className="px-6 py-4">ชื่อตำแหน่งงาน</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {positions.map((pos) => (
                <tr key={pos.positionID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">#{pos.positionID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{pos.positionName}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(pos)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(pos.positionID)}
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
                {isEdit ? "แก้ไขตำแหน่งงาน" : "เพิ่มตำแหน่งงานใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อตำแหน่งงาน *</label>
                <input
                  type="text"
                  required
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="เช่น ผู้ช่วยแอดมิน, ฝ่ายจัดส่ง"
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
