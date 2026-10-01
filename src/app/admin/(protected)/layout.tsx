import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { adminCookies } from "@/lib/admin-session";
import { getMe, type UserResponse } from "@/lib/backend";
import AdminNavigation from "./navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(adminCookies.access)?.value;
  const refreshToken = cookieStore.get(adminCookies.refresh)?.value;
  if (!accessToken) redirect(refreshToken ? "/admin/session/refresh" : "/admin/login");

  let response: Response;
  try {
    response = await getMe(accessToken);
  } catch {
    throw new Error("관리자 정보를 확인할 수 없습니다.");
  }
  if (response.status === 401) {
    redirect(refreshToken ? "/admin/session/refresh" : "/admin/login");
  }
  if (!response.ok) throw new Error("관리자 정보를 확인할 수 없습니다.");

  const user = (await response.json()) as UserResponse;
  if (user.role !== "ADMIN") redirect("/admin/login?reason=forbidden");

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
        <Link href="/admin" className="block text-lg font-bold tracking-tight">POPKU 관리자</Link>
        <AdminNavigation />
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
