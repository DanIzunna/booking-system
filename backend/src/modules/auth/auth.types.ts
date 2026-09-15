import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
  refreshToken: string;
}
