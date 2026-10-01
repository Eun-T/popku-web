export type TokenResponse = {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  refreshExpiresInSeconds: number;
  deviceId: string;
};

export type UserResponse = {
  id: number;
  email: string;
  nickname: string;
  profileImageKey: string | null;
  provider: string;
  role: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export function backendUrl(path: string): string {
  const base = process.env.BACKEND_API_URL;
  if (!base) throw new Error("BACKEND_API_URL is required");
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function getMe(accessToken: string): Promise<Response> {
  return fetch(backendUrl("/api/users/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}
