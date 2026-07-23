import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className = "" }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-navy-900">
        {label}
        {required ? <span aria-hidden="true" className="ml-0.5 text-blue-500"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-[12.5px] text-gray-600">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
