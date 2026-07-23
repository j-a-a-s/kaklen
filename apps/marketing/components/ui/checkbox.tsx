import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, ...props },
  ref
) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-gray-700">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-800/25 text-blue-500 focus:ring-2 focus:ring-blue-500/30 aria-[invalid=true]:border-red-500"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});
