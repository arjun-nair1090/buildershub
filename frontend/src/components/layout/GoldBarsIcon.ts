import { createLucideIcon } from "lucide-react";

/** The stacked gold bars as a line icon, matching lucide's 24 px grid and stroke, for nav items and empty states. */
export const GoldBarsIcon = createLucideIcon("gold-bars", [
  ["path", { d: "M2 20.5h9l-1.5-6H3.5Z", key: "left" }],
  ["path", { d: "M13 20.5h9l-1.5-6h-6Z", key: "right" }],
  ["path", { d: "M7.5 12h9L15 6H9Z", key: "top" }],
]);
