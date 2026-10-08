import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

interface CodeEntryFormProps {
  className?: string;
  tone?: "light" | "dark";
  autoFocus?: boolean;
}

/** Manual fallback for buyers who can't scan: enter the Jewellery ID printed under the QR. */
export function CodeEntryForm({ className, tone = "light", autoFocus }: CodeEntryFormProps) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9-]{4,32}$/.test(cleaned)) {
      setError("Enter the ID exactly as printed, for example JWL-26-A8F72K.");
      return;
    }
    setError(null);
    navigate(`/verify/${cleaned}`);
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <label htmlFor="jewellery-code" className={cn("mb-2 block text-[13px] font-medium", tone === "dark" ? "text-chalk/80" : "text-ink")}>
        Jewellery ID
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="jewellery-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="JWL-26-A8F72K"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "jewellery-code-error" : undefined}
          className="tabular h-12 tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal"
        />
        <Button type="submit" size="lg" variant={tone === "dark" ? "gold" : "primary"} className="h-12 shrink-0">
          <Search /> Verify
        </Button>
      </div>
      {error && (
        <p id="jewellery-code-error" role="alert" className={cn("mt-2 text-[13px]", tone === "dark" ? "text-[#f2c9c2]" : "text-danger")}>
          {error}
        </p>
      )}
    </form>
  );
}
