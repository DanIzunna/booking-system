export type PlatformRole = "USER" | "ADMIN";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  platformRole: PlatformRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
