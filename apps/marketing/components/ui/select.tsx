import { forwardRef, type SelectHTMLAttributes } from "react";

const CLASSES =
  "w-full appearance-none rounded-lg border border-navy-800/15 bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23526074%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat px-3.5 py-2.5 pr-9 text-[14.5px] text-navy-950 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 aria-[invalid=true]:border-red-500";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return <select ref={ref} className={CLASSES} {...props} />;
  }
);
