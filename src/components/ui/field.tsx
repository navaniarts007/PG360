import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[0.95rem] text-ink shadow-[inset_0_1px_2px_rgba(66,45,24,0.04)] transition-colors placeholder:text-ink-muted/70 focus:border-clay-400 focus:outline-none focus:ring-4 focus:ring-clay-500/12 disabled:opacity-60";

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: React.ReactNode }) {
  return (
    <label
      className={cn(
        "mb-1.5 flex items-center justify-between text-sm font-medium text-ink-soft",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-11 appearance-none bg-[length:1.1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%238b8071%22 stroke-width=%222%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22/></svg>')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldRow({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  );
}
