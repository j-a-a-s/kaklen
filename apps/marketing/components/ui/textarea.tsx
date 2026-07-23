import { forwardRef, type TextareaHTMLAttributes } from "react";

const CLASSES =
  "w-full resize-y rounded-lg border border-navy-800/15 bg-white px-3.5 py-2.5 text-[14.5px] text-navy-950 placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 aria-[invalid=true]:border-red-500";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return <textarea ref={ref} rows={5} className={CLASSES} {...props} />;
  }
);
