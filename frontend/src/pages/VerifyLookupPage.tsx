import { Camera } from "lucide-react";
import { useEffect } from "react";
import { CodeEntryForm } from "@/components/verify/CodeEntryForm";

export function VerifyLookupPage() {
  useEffect(() => {
    document.title = "Verify jewellery";
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <h1 className="font-display text-[34px] leading-tight text-emerald sm:text-[42px]">Verify jewellery</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-charcoal/75">
        Check a piece against its registered digital record.
      </p>

      <div className="mt-10 rounded-lg border border-line bg-white">
        <div className="flex gap-4 border-b border-line p-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald">
            <Camera className="size-5" strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-charcoal">Scan the QR code</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Open your phone camera and point it at the QR code on the tag or certificate card. The record opens in
              your browser. No app needed.
            </p>
          </div>
        </div>
        <div className="p-6">
          <h2 className="mb-1 text-[15px] font-semibold text-charcoal">Or enter the Jewellery ID</h2>
          <p className="mb-5 text-[15px] text-muted">It is printed under the QR code.</p>
          <CodeEntryForm autoFocus />
        </div>
      </div>
    </div>
  );
}
