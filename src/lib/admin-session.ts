import type { NextResponse } from "next/server";
import type { TokenResponse } from "@/lib/backend";

export const adminCookies = {
  access: "popku_admin_access",
  refresh: "popku_admin_refresh",
  device: "popku_admin_device",
} as const;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/admin",
};

export function setAdminSession(response: NextResponse, tokens: TokenResponse): void {
  response.cookies.set(adminCookies.access, tokens.accessToken, {
    ...cookieOptions,
    maxAge: tokens.accessExpiresInSeconds,
  });
  response.cookies.set(adminCookies.refresh, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: tokens.refreshExpiresInSeconds,
  });
  response.cookies.set(adminCookies.device, tokens.deviceId, {
    ...cookieOptions,
    maxAge: tokens.refreshExpiresInSeconds,
  });
}

export function clearAdminSession(response: NextResponse): void {
  for (const name of Object.values(adminCookies)) {
    response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  }
}
