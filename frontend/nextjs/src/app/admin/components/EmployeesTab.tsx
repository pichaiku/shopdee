/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Upload, X } from "lucide-react";
import { getEmployees, getPositions, createEmployee, updateEmployee, deleteEmployee } from "@/lib/api";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
interface EmployeesTabProps {
  token: string;
}

export default function EmployeesTab({ token }: EmployeesTabProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog / Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedEmpID, setSelectedEmpID] = useState<number | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [gender, setGender] = useState("0");
  const [positionID, setPositionID] = useState("2"); // default to 2 (พนักงาน)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await getEmployees(token);
      setEmployees(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลพนักงานได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    const loadPositions = async () => {
      try {
        const posts = await getPositions();
        setPositions(posts);
      } catch (err) {
        console.error(err);
      }
    };
    loadPositions();
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSelectedEmpID(null);
    setUsername("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setMobilePhone("");
    setGender("0");
    setPositionID("2");
    setImageFile(null);
    setImagePreview(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setIsEdit(true);
    setSelectedEmpID(emp.empID);
    setUsername(emp.username || "");
    setPassword("");
    setFirstName(emp.firstName || "");
    setLastName(emp.lastName || "");
    setEmail(emp.email || "");
    setMobilePhone(emp.mobilePhone || "");
    setGender(emp.gender !== null && emp.gender !== undefined ? String(emp.gender) : "0");
    setPositionID(emp.positionID ? String(emp.positionID) : "2");
    setImageFile(null);
    setImagePreview(emp.imageFile ? `${PUBLIC_API_BASE}/employee/image/${emp.imageFile}` : null);
    setIsOpen(true);
  };

  const handleDelete = async (empID: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานคนนี้?")) return;
    try {
      const res = await deleteEmployee(empID, token);
      if (res.status) {
        alert(res.message);
        loadEmployees();
      } else {
        alert(res.message || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !firstName || !lastName) {
      alert("กรุณากรอกฟิลด์ที่จำเป็น (Username, ชื่อ, นามสกุล)");
      return;
    }

    const formData = new FormData();
    formData.append("username", username);
    if (password) {
      formData.append("password", password);
    }
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("email", email);
    formData.append("mobilePhone", mobilePhone);
    formData.append("gender", gender);
    formData.append("positionID", positionID);
    if (imageFile) {
      formData.append("imageFile", imageFile);
    }

    try {
      if (isEdit && selectedEmpID) {
        const res = await updateEmployee(selectedEmpID, formData, token);
        if (res.status) {
          alert(res.message);
          setIsOpen(false);
          loadEmployees();
        } else {
          alert(res.message || "เกิดข้อผิดพลาด");
        }
      } else {
        const res = await createEmployee(formData, token);
        if (res.status) {
          let msg = res.message;
          if (res.tempPassword) {
            msg += `\n\nรหัสผ่านสำหรับพนักงานคนนี้คือ: ${res.tempPassword}\n(กรุณาบันทึกหรือแจ้งให้พนักงานคนนี้ทราบ)`;
          }
          alert(msg);
          setIsOpen(false);
          loadEmployees();
        } else {
          alert(res.message || "เกิดข้อผิดพลาด");
        }
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ข้อมูลพนักงาน</h2>
          <p className="text-slate-500 text-sm font-sans">รายชื่อพนักงานและตำแหน่งในระบบ แอดมินสามารถจัดการแก้ไขได้</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มพนักงานใหม่
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">รูปภาพ</th>
                <th className="px-6 py-4">รหัสพนักงาน</th>
                <th className="px-6 py-4">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">เบอร์โทรศัพท์</th>
                <th className="px-6 py-4">ตำแหน่ง</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp) => (
                <tr key={emp.empID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                      {emp.imageFile ? (
                        <img
                          src={`${PUBLIC_API_BASE}/employee/image/${emp.imageFile}`}
                          alt={emp.firstName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">{emp.firstName[0]}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">#{emp.empID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{emp.firstName} {emp.lastName}</td>
                  <td className="px-6 py-4 text-slate-600">{emp.username}</td>
                  <td className="px-6 py-4 text-slate-600">{emp.mobilePhone || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${emp.positionID === 1 ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}>
                      {emp.positionName || "พนักงาน"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(emp.empID)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold text-xs px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 cursor-pointer transition"
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

      {/* Employee Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">
                {isEdit ? `แก้ไขข้อมูลพนักงาน ID: #${selectedEmpID}` : "เพิ่มข้อมูลพนักงานใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-6 text-sm">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer transition">
                  <Upload className="h-3.5 w-3.5" /> เลือกรูปพนักงาน
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Login Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="Username พนักงาน"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Password {isEdit ? "(เว้นว่างเพื่อไม่เปลี่ยนรหัสผ่าน)" : "(เว้นว่างไว้เพื่อสร้างรหัสสุ่ม)"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="รหัสผ่านเข้าใช้งาน"
                  />
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อจริง *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="ชื่อจริง"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">นามสกุล *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="นามสกุล"
                  />
                </div>
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เบอร์โทรศัพท์มือถือ</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={mobilePhone}
                    onChange={(e) => setMobilePhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="เช่น 0891234567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">อีเมล</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="name@email.com"
                  />
                </div>
              </div>

              {/* Gender & Position selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เพศ</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer"
                  >
                    <option value="0">ชาย</option>
                    <option value="1">หญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ตำแหน่งงาน</label>
                  <select
                    value={positionID}
                    onChange={(e) => setPositionID(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer"
                  >
                    {positions.map((pos) => (
                      <option key={pos.positionID} value={pos.positionID}>{pos.positionName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-white hover:bg-slate-800 font-semibold cursor-pointer shadow-sm"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
