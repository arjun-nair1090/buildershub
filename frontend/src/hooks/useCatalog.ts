import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";

/** The browsable catalogue, loaded once per page view. */
export function useCatalog() {
  return usePublicRecord("catalog", (signal) => publicService.catalog(signal));
}
