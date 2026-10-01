import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">POPKU</h1>
      <p className="text-sm text-slate-600">POPKU 웹을 준비하고 있습니다.</p>
      <Link className="text-sm font-medium text-blue-700 underline underline-offset-4" href="/admin/login">
        관리자 로그인
      </Link>
    </main>
  );
}
