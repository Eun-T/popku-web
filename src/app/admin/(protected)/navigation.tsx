"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavigation() {
  const pathname = usePathname();
  const items = [
    { href: "/admin/home-curations", label: "뜨는 관리" },
    { href: "/admin/popups", label: "팝업 관리" },
    { href: "/admin/tags", label: "태그 관리" },
    { href: "/admin/regions", label: "지역 관리" },
  ];

  return (
    <nav aria-label="관리자 메뉴" className="mt-8">
      {items.map(({ href, label }) => {
        const selected = pathname === href;
        return <Link key={href} href={href} aria-current={selected ? "page" : undefined}
          className={`block rounded-md px-3 py-2 text-sm font-semibold ${selected ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
          {label}
        </Link>;
      })}
    </nav>
  );
}
