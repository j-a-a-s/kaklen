import type { SolutionIcon } from "@/content/solutions";

const COMMON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export function SolutionIconGlyph({ icon, className = "" }: { icon: SolutionIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {renderIcon(icon)}
    </svg>
  );
}

function renderIcon(icon: SolutionIcon) {
  switch (icon) {
    case "compass":
      return (
        <>
          <circle cx="12" cy="12" r="9" {...COMMON} />
          <path d="M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z" {...COMMON} />
        </>
      );
    case "layers":
      return (
        <>
          <rect x="4" y="4" width="16" height="4.4" rx="1" {...COMMON} />
          <rect x="4" y="10" width="16" height="4.4" rx="1" {...COMMON} />
          <rect x="4" y="16" width="16" height="4.4" rx="1" {...COMMON} />
        </>
      );
    case "grid":
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1" {...COMMON} />
          <rect x="13" y="4" width="7" height="7" rx="1" {...COMMON} />
          <rect x="4" y="13" width="7" height="7" rx="1" {...COMMON} />
          <rect x="13" y="13" width="7" height="7" rx="1" {...COMMON} />
        </>
      );
    case "bolt":
      return <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" {...COMMON} />;
    case "structure":
      return (
        <>
          <circle cx="12" cy="4.5" r="2.3" {...COMMON} />
          <circle cx="5" cy="18" r="2.3" {...COMMON} />
          <circle cx="19" cy="18" r="2.3" {...COMMON} />
          <path d="M12 6.8V12M12 12 6.4 16M12 12 17.6 16" {...COMMON} />
        </>
      );
    case "spark":
      return <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10 12 2Z" {...COMMON} />;
    case "chat":
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="12" rx="2.2" {...COMMON} />
          <path d="M7 16.5v3.4L11 16.5" {...COMMON} />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M4 20V4M4 20h16" {...COMMON} />
          <path d="M8 20v-6M13 20V9M18 20v-9" {...COMMON} />
        </>
      );
    case "link":
      return (
        <>
          <circle cx="9" cy="12" r="5" {...COMMON} />
          <circle cx="15" cy="12" r="5" {...COMMON} />
        </>
      );
    case "cloud":
      return <path d="M7 18h10a4 4 0 0 0 .5-7.97 5.5 5.5 0 0 0-10.6-1.5A4.5 4.5 0 0 0 7 18Z" {...COMMON} />;
    default:
      return null;
  }
}
