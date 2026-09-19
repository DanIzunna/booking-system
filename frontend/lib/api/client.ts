import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../auth/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
let refreshPromise: Promise<boolean> | null = null;

export interface ApiErrorBody {
  statusCode?: number;
  message?: unknown;
  details?: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface ApiRequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetchRequest(path, options);

  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !isAuthEndpoint(path)
  ) {
    const refreshed = await getOrRefreshAccessToken();
    if (refreshed) {
      return parseResponse<T>(await fetchRequest(path, options, true));
    }
  }

  return parseResponse<T>(response);
}

async function fetchRequest(
  path: string,
  options: ApiRequestOptions,
  retry = false,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.body,
    signal: options.signal,
    method: options.method ?? "GET",
    ...(retry ? { cache: "no-store" } : {}),
  });
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetchRequest("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    });

    if (!response.ok) {
      clearAccessToken();
      return false;
    }

    const body = (await response.json()) as { accessToken?: string };
    if (!body.accessToken) {
      clearAccessToken();
      return false;
    }

    setAccessToken(body.accessToken);
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

async function getOrRefreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => undefined)) as
    | ApiErrorBody
    | T
    | undefined;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      formatMessage(errorBody?.message) ||
        response.statusText ||
        "Request failed",
      errorBody?.details,
    );
  }

  return body as T;
}

function formatMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message.map(formatMessage).filter(Boolean).join(", ");
  }
  if (message && typeof message === "object" && "message" in message) {
    return formatMessage(message.message);
  }
  if (message === null || message === undefined) return "";
  if (typeof message === "object") {
    try {
      return JSON.stringify(message);
    } catch {
      return "Request failed";
    }
  }
  return String(message);
}

export function getUserFacingError(
  error: unknown,
  fallback: string,
): string {
  const rawMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "";

  if (!rawMessage) return fallback;

  const message = rawMessage.toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed")
  ) {
    return "We could not reach the server. Please try again.";
  }

  if (message.includes("not found")) {
    return "This item could not be found.";
  }

  if (
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("taken")
  ) {
    return "This option is already in use. Please choose a different one.";
  }

  if (
    message.includes("required") ||
    message.includes("missing") ||
    message.includes("invalid") ||
    message.includes("validation")
  ) {
    return "Please check the required details and try again.";
  }

  if (message.includes("forbidden") || message.includes("unauthorized")) {
    return "You do not have access to this workspace.";
  }

  if (message.includes("stripe")) {
    return "Payment setup is temporarily unavailable. Please try again shortly.";
  }

  if (message.includes("email")) {
    return "Please review the email address and try again.";
  }

  return fallback;
}

function isAuthEndpoint(path: string): boolean {
  return /^\/auth\/(register|login|refresh|logout)(?:$|\?)/.test(path);
}
