import { createLucideIcon } from "lucide-react";

/** The gold bar as a line icon, matching lucide's 24 px grid and stroke, for nav items and empty states. */
export const GoldBarIcon = createLucideIcon("gold-bar", [
  ["path", { d: "M2.5 19.5h19l-3.4-8.5H5.9Z", key: "front" }],
  ["path", { d: "M5.9 11 8 5.5h8l2.1 5.5", key: "top" }],
]);
