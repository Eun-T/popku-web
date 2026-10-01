import { NextRequest, NextResponse } from "next/server";
import { adminCookies, clearAdminSession, setAdminSession } from "@/lib/admin-session";
import { backendUrl, getMe, type TokenResponse, type UserResponse } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get(adminCookies.refresh)?.value;
  const deviceId = request.cookies.get(adminCookies.device)?.value;
  let reason = "expired";

  if (refreshToken && deviceId) {
    try {
      const refreshResponse = await fetch(backendUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, deviceId }),
        cache: "no-store",
      });
      if (refreshResponse.ok) {
        const tokens = (await refreshResponse.json()) as TokenResponse;
        const meResponse = await getMe(tokens.accessToken);
        if (meResponse.ok) {
          const user = (await meResponse.json()) as UserResponse;
          if (user.role === "ADMIN") {
            const response = NextResponse.redirect(new URL("/admin", request.url));
            setAdminSession(response, tokens);
            return response;
          }
          reason = "forbidden";
        }
      }
    } catch {
      reason = "unavailable";
    }
  }

  const response = NextResponse.redirect(new URL(`/admin/login?reason=${reason}`, request.url));
  clearAdminSession(response);
  return response;
}
