import HomeCurationManager from "./home-curation-manager";

export default function HomeCurationsPage() {
  return <section>
    <h1 className="text-2xl font-semibold tracking-tight">지금 뜨는 팝업</h1>
    <p className="mt-2 text-sm text-slate-600">홈에 노출할 팝업을 직접 선택하고 순서를 관리합니다.</p>
    <HomeCurationManager />
  </section>;
}
