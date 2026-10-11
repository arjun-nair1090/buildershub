import { z } from "zod";

// Zod probes `new Function` once to decide whether it can compile schemas; the strict CSP blocks it, and the
// browser reports a violation even though zod catches the error. jitless skips the probe (validation is the same).
z.config({ jitless: true });

export { z };
