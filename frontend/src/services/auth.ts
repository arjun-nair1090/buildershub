import { request } from "./api";
import type { AdminUser, LoginResponse, User } from "@/types";

export const authService = {
  login: (email: string, password: string, remember: boolean) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password, remember },
      auth: false,
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
  listAdmins: () => request<AdminUser[]>("/api/auth/admins"),
  createAdmin: (body: { name: string; email: string; password: string }) =>
    request<AdminUser>("/api/auth/admins", { method: "POST", body }),
  resetAdminPassword: (email: string, password: string) =>
    request<void>(`/api/auth/admins/${encodeURIComponent(email)}/password`, { method: "PUT", body: { password } }),
  removeAdmin: (email: string) => request<void>(`/api/auth/admins/${encodeURIComponent(email)}`, { method: "DELETE" }),
};
