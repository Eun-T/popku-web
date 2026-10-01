import Link from "next/link";
import PopupTable from "./popup-table";

export default function AdminPopupsPage() {
  return (
    <section>
      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">팝업 관리</h1>
          <Link href="/admin/popups/new" className="shrink-0 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            + 팝업 등록
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">등록된 팝업을 관리합니다.</p>
      </div>
      <PopupTable />
    </section>
  );
}
