import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS = {
  primary: "bg-blue-500 text-white hover:bg-blue-600 px-7 py-3.5 text-[15px]",
  ghost: "bg-white/10 text-white border border-white/25 hover:bg-white/20 px-7 py-3.5 text-[15px] backdrop-blur",
  outline: "border border-navy-800/15 text-navy-950 hover:border-blue-500 hover:text-blue-600 px-7 py-3.5 text-[15px]"
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <a className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </a>
  );
}
