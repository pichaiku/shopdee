"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout, { authInputClass } from "@/components/shop/AuthLayout";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"customer" | "admin">("customer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const url = `${PUBLIC_API_BASE}/${mode === "customer" ? "login" : "admin/login"}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setMessage(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }

      const user = {
        type: mode,
        id: data.custID ?? data.empID,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      };
      localStorage.setItem("shopdee_token", data.token);
      localStorage.setItem("shopdee_user", JSON.stringify(user));
      router.push(mode === "customer" ? "/" : "/admin");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถเชื่อมต่อระบบได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ยินดีต้อนรับกลับมา 👋</h1>
          <p className="text-slate-500">เข้าสู่ระบบเพื่อช้อปต่อและดูสินค้าแนะนำสำหรับคุณ</p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
          {(
            [
              { key: "customer", label: "ลูกค้า" },
              { key: "admin", label: "พนักงาน" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${mode === m.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-slate-700">ชื่อผู้ใช้</label>
            <input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={authInputClass} required />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${authInputClass} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {message ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-400"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            เข้าสู่ระบบ{mode === "admin" ? " (พนักงาน)" : ""}
          </button>
        </form>

        {mode === "customer" ? (
          <p className="text-center text-sm text-slate-500">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              สมัครสมาชิกฟรี
            </Link>
          </p>
        ) : null}
      </div>
    </AuthLayout>
  );
}
