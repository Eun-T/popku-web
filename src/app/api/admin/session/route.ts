import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { backendUrl, getMe, type TokenResponse, type UserResponse } from "@/lib/backend";
import { setAdminSession } from "@/lib/admin-session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ message: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const loginResponse = await fetch(backendUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, deviceId: randomUUID() }),
      cache: "no-store",
    });
    if (!loginResponse.ok) {
      return NextResponse.json(
        { message: loginResponse.status === 401 ? "이메일 또는 비밀번호를 확인해 주세요." : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: loginResponse.status === 401 ? 401 : 502 },
      );
    }

    const tokens = (await loginResponse.json()) as TokenResponse;
    if (!tokens.accessToken || !tokens.refreshToken || !tokens.deviceId || tokens.tokenType !== "Bearer") {
      throw new Error("Unexpected login response");
    }

    const meResponse = await getMe(tokens.accessToken);
    if (!meResponse.ok) throw new Error("Could not verify user");
    const user = (await meResponse.json()) as UserResponse;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ message: "관리자 권한이 없는 계정입니다." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    setAdminSession(response, tokens);
    return response;
  } catch {
    return NextResponse.json(
      { message: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
