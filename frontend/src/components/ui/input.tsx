import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

const fieldBase =
  "w-full rounded-md border border-line-strong bg-white text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-basalt focus:outline-none focus:ring-2 focus:ring-basalt/15 disabled:cursor-not-allowed disabled:bg-chalk disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Text or icon shown inside the field on the left, e.g. ₹. */
  prefix?: string;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, prefix, suffix, ...props }, ref) => {
  if (!prefix && !suffix) {
    return <input ref={ref} className={cn(fieldBase, "h-10 px-3", className)} {...props} />;
  }
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        className={cn(fieldBase, "h-10 px-3", prefix && "pl-7", suffix && "pr-10", className)}
        {...props}
      />
      {suffix && <span className="absolute inset-y-0 right-0 flex items-center pr-1">{suffix}</span>}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** Native select: best behaviour on phones, styled to match the inputs. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, "h-10 appearance-none pl-3 pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  ),
);
Select.displayName = "Select";
