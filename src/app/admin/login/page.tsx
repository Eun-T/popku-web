import AdminLoginForm from "./login-form";

type Props = { searchParams: Promise<{ reason?: string }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const messages: Record<string, string> = {
    forbidden: "관리자 권한이 없는 계정입니다.",
    expired: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    unavailable: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  };
  return <AdminLoginForm initialError={reason ? messages[reason] : undefined} />;
}
