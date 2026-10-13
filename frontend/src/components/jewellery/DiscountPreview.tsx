import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { jewelleryService } from "@/services/jewellery";
import type { PiecePrice, PricePreviewInput } from "@/types";
import { formatINRRange } from "@/utils/format";

/** What buyers would see, priced by the server so it matches the QR page exactly. */
export function DiscountPreview({ input }: { input: PricePreviewInput | null }) {
  const key = useDebounce(input ? JSON.stringify(input) : "", 400);
  const [price, setPrice] = useState<PiecePrice | null>(null);

  useEffect(() => {
    if (!key) {
      setPrice(null);
      return;
    }
    const controller = new AbortController();
    jewelleryService
      .pricePreview(JSON.parse(key) as PricePreviewInput, controller.signal)
      .then(setPrice)
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setPrice(null);
      });
    return () => controller.abort();
  }, [key]);

  return (
    <div className="rounded-md border border-line bg-canvas p-4" aria-live="polite">
      {price ? (
        <>
          <p className="text-[13px] text-muted">
            {price.basis === "live" ? "Buyers see today, at the live gold rate:" : "Buyers see (no live gold rate yet, so the registered price):"}
          </p>
          {price.discount && (
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">{price.discount.label}</span>
            </p>
          )}
          <p className="tabular mt-1 text-xl font-semibold text-ink">{formatINRRange(price.final_min, price.final_max)}</p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Fill in the weight and prices to preview what buyers will see.</p>
      )}
    </div>
  );
}
