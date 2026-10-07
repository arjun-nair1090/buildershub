import { request } from "./api";
import type { LoginResponse, User } from "@/types";

export const authService = {
  login: (email: string, password: string, remember: boolean) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password, remember },
      auth: false,
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
};
