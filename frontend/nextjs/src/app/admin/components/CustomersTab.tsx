/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Eye, Upload, X } from "lucide-react";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getProvinces, getDistricts, getSubdistricts } from "@/lib/api";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
interface CustomersTabProps {
  token: string;
}

export default function CustomersTab({ token }: CustomersTabProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Dialog / Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedCustID, setSelectedCustID] = useState<number | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [gender, setGender] = useState("0"); // "0" for Male, "1" for Female, "-1" for none
  const [birthdate, setBirthdate] = useState("");
  const [address, setAddress] = useState("");

  // Location selectors in form
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [subdistricts, setSubdistricts] = useState<any[]>([]);
  const [selectedProvinceID, setSelectedProvinceID] = useState("");
  const [selectedDistrictID, setSelectedDistrictID] = useState("");
  const [selectedSubdistrictID, setSelectedSubdistrictID] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomers(token);
      setCustomers(data);
    } catch (err: any) {
      setMessage(err.message || "ไม่สามารถโหลดข้อมูลลูกค้าได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    const loadProvinces = async () => {
      try {
        const provs = await getProvinces();
        setProvinces(provs);
      } catch (err) {
        console.error("Failed to load provinces:", err);
      }
    };
    loadProvinces();
  }, []);

  // Form Location cascades
  useEffect(() => {
    if (!selectedProvinceID) {
      setDistricts([]);
      setSelectedDistrictID("");
      setSubdistricts([]);
      setSelectedSubdistrictID("");
      return;
    }
    const loadDists = async () => {
      try {
        const dists = await getDistricts(selectedProvinceID);
        setDistricts(dists);
        setSelectedDistrictID("");
        setSubdistricts([]);
        setSelectedSubdistrictID("");
      } catch (err) {
        console.error(err);
      }
    };
    loadDists();
  }, [selectedProvinceID]);

  useEffect(() => {
    if (!selectedDistrictID) {
      setSubdistricts([]);
      setSelectedSubdistrictID("");
      return;
    }
    const loadSubs = async () => {
      try {
        const subs = await getSubdistricts(selectedDistrictID);
        setSubdistricts(subs);
        setSelectedSubdistrictID("");
      } catch (err) {
        console.error(err);
      }
    };
    loadSubs();
  }, [selectedDistrictID]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSelectedCustID(null);
    setUsername("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setMobilePhone("");
    setHomePhone("");
    setGender("0");
    setBirthdate("");
    setAddress("");
    setSelectedProvinceID("");
    setSelectedDistrictID("");
    setSelectedSubdistrictID("");
    setImageFile(null);
    setImagePreview(null);
    setIsOpen(true);
  };

  const handleOpenEdit = async (cust: any) => {
    setIsEdit(true);
    setSelectedCustID(cust.custID);
    setUsername(cust.username || "");
    setPassword(""); // Keep blank to not change password
    setFirstName(cust.firstName || "");
    setLastName(cust.lastName || "");
    setEmail(cust.email || "");
    setMobilePhone(cust.mobilePhone || "");
    setHomePhone(cust.homePhone || "");
    setGender(cust.gender !== null && cust.gender !== undefined ? String(cust.gender) : "-1");
    setBirthdate(cust.birthdate ? cust.birthdate.substring(0, 10) : "");
    setAddress(cust.address || "");
    setImageFile(null);
    setImagePreview(cust.imageFile ? `${PUBLIC_API_BASE}/customer/image/${cust.imageFile}` : null);

    // Try to pre-fill location selectors if subdistrictID is present
    if (cust.subdistrictID) {
      setSelectedSubdistrictID(cust.subdistrictID);
      // Wait, we need province and district to display selectors correctly!
      // In a real app we'd fetch details by subdistrictID. But to keep it simple and robust,
      // let's fetch the first 2 chars of subdistrictID as provinceID (e.g. 10xxxx -> 10)
      // and first 4 chars as districtID (e.g. 1001xx -> 1001)
      const provID = cust.subdistrictID.substring(0, 2);
      const distID = cust.subdistrictID.substring(0, 4);
      setSelectedProvinceID(provID);
      // Force load districts and select
      try {
        const dists = await getDistricts(provID);
        setDistricts(dists);
        setSelectedDistrictID(distID);
        const subs = await getSubdistricts(distID);
        setSubdistricts(subs);
        setSelectedSubdistrictID(cust.subdistrictID);
      } catch (err) {
        console.error("Error setting cascades on edit:", err);
      }
    } else {
      setSelectedProvinceID("");
      setSelectedDistrictID("");
      setSelectedSubdistrictID("");
    }

    setIsOpen(true);
  };

  const handleDelete = async (custID: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้าคนนี้?")) return;
    try {
      const res = await deleteCustomer(custID, token);
      if (res.status) {
        alert(res.message);
        loadCustomers();
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
      alert("กรุณากรอกข้อมูลในฟิลด์ที่จำเป็น (Username, ชื่อ, นามสกุล)");
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
    formData.append("homePhone", homePhone);
    formData.append("gender", gender);
    if (birthdate) {
      formData.append("birthdate", birthdate);
    }
    formData.append("address", address);
    if (selectedSubdistrictID) {
      formData.append("subdistrictID", selectedSubdistrictID);
    }
    if (imageFile) {
      formData.append("imageFile", imageFile);
    }

    try {
      let res;
      if (isEdit && selectedCustID) {
        res = await updateCustomer(selectedCustID, formData, token);
      } else {
        if (!password) {
          formData.append("password", "1234"); // Default password if empty on creation
        }
        res = await createCustomer(formData, token);
      }

      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        loadCustomers();
      } else {
        alert(res.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ข้อมูลลูกค้า</h2>
          <p className="text-slate-500 text-sm">รายชื่อสมาชิกและลูกค้าทั้งหมดในระบบ สามารถเพิ่ม แก้ไข หรือลบข้อมูลได้</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มรายชื่อลูกค้า
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
                <th className="px-6 py-4">รหัสลูกค้า</th>
                <th className="px-6 py-4">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">เบอร์โทรศัพท์</th>
                <th className="px-6 py-4">อีเมล</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map((c) => (
                <tr key={c.custID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                      {c.imageFile ? (
                        <img
                          src={`${PUBLIC_API_BASE}/customer/image/${c.imageFile}`}
                          alt={c.firstName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">{c.firstName[0]}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">#{c.custID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{c.firstName} {c.lastName}</td>
                  <td className="px-6 py-4 text-slate-600">{c.username}</td>
                  <td className="px-6 py-4 text-slate-600">{c.mobilePhone || "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{c.email || "-"}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(c.custID)}
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

      {/* CRUD Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">
                {isEdit ? `แก้ไขข้อมูลลูกค้า ID: #${selectedCustID}` : "เพิ่มข้อมูลลูกค้าใหม่"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-6 text-sm">
              {/* Profile Image Upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer transition">
                  <Upload className="h-3.5 w-3.5" /> เลือกรูปโปรไฟล์
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
                    placeholder="Username ของลูกค้า"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Password {isEdit ? "(เว้นว่างไว้เพื่อใช้รหัสผ่านเดิม)" : "* (หากเว้นว่าง ระบบจะตั้งเป็น 1234)"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="รหัสผ่าน"
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

              {/* Contact Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เบอร์มือถือ</label>
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เบอร์บ้าน</label>
                  <input
                    type="text"
                    maxLength={9}
                    value={homePhone}
                    onChange={(e) => setHomePhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="เช่น 021234567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">อีเมล</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="customer@email.com"
                  />
                </div>
              </div>

              {/* Gender & Birthdate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เพศ</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer"
                  >
                    <option value="-1">ไม่ระบุ</option>
                    <option value="0">ชาย</option>
                    <option value="1">หญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">วันเกิด</label>
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  />
                </div>
              </div>

              {/* Address details */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="font-semibold text-slate-950">ที่อยู่และการจัดส่ง</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">บ้านเลขที่ ถนน ซอย</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                    placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน"
                  />
                </div>

                {/* Location drilldowns */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">จังหวัด</label>
                    <select
                      value={selectedProvinceID}
                      onChange={(e) => setSelectedProvinceID(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none bg-white transition cursor-pointer"
                    >
                      <option value="">-- เลือกจังหวัด --</option>
                      {provinces.map((p) => (
                        <option key={p.provinceID} value={p.provinceID}>{p.provinceName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">อำเภอ</label>
                    <select
                      value={selectedDistrictID}
                      onChange={(e) => setSelectedDistrictID(e.target.value)}
                      disabled={!selectedProvinceID}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- เลือกอำเภอ --</option>
                      {districts.map((d) => (
                        <option key={d.districtID} value={d.districtID}>{d.districtName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ตำบล</label>
                    <select
                      value={selectedSubdistrictID}
                      onChange={(e) => setSelectedSubdistrictID(e.target.value)}
                      disabled={!selectedDistrictID}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- เลือกตำบล --</option>
                      {subdistricts.map((sd) => (
                        <option key={sd.subdistrictID} value={sd.subdistrictID}>{sd.subdistrictName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-slate-700 hover:bg-slate-50 font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-white hover:bg-slate-800 font-semibold transition shadow-sm cursor-pointer"
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
