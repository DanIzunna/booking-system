import { apiRequest } from "./client";
import { AuthenticatedUser, AuthResponse } from "../../types/auth";
import { clearAccessToken, setAccessToken } from "../auth/session";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
    skipAuthRefresh: true,
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
    skipAuthRefresh: true,
  });
  setAccessToken(response.accessToken);
  return response;
}

export async function refresh(): Promise<AuthResponse> {
  try {
    const response = await apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    });
    setAccessToken(response.accessToken);
    return response;
  } catch (error) {
    clearAccessToken();
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
    });
  } finally {
    clearAccessToken();
  }
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>("/auth/me");
}
