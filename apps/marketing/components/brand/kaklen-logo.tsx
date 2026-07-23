/**
 * Recreación fiel en CSS/SVG del isotipo real de Kaklen (K geométrica navy + trazo
 * diagonal en degradado azul) mientras no exista el archivo vectorial oficial.
 * En cuanto se agreguen los assets reales a /public/brand, este componente puede
 * apuntar directamente a ellos sin tocar quién lo consume.
 */
const GRADIENT_ID = "kaklen-k-gradient";

export function KaklenMark({ className = "", tone = "auto" }: { className?: string; tone?: "auto" | "light" }) {
  const barColor = tone === "light" ? "#ffffff" : "#0a1c38";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={GRADIENT_ID} x1="20%" y1="100%" x2="90%" y2="0%">
          <stop offset="0%" stopColor="#144fa8" />
          <stop offset="100%" stopColor="#52b9ff" />
        </linearGradient>
      </defs>
      <rect x="13" y="7" width="12" height="50" fill={barColor} />
      <path d="M25 31 L53 6" stroke={`url(#${GRADIENT_ID})`} strokeWidth="12" strokeLinecap="square" />
      <path d="M25 33 L53 58" stroke={`url(#${GRADIENT_ID})`} strokeWidth="12" strokeLinecap="square" opacity="0.82" />
    </svg>
  );
}

interface KaklenLogoProps {
  tone?: "auto" | "light";
  showTagline?: boolean;
  className?: string;
}

export function KaklenLogo({ tone = "auto", showTagline = false, className = "" }: KaklenLogoProps) {
  const textColor = tone === "light" ? "text-white" : "text-navy-950";
  const taglineColor = tone === "light" ? "text-cyan-400" : "text-blue-600";
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <KaklenMark tone={tone} className="h-8 w-8 shrink-0" />
      <div className="flex flex-col leading-none">
        <span className={`font-display text-[19px] font-extrabold tracking-[0.04em] ${textColor}`}>KAKLEN</span>
        {showTagline ? (
          <span className={`mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] ${taglineColor}`}>
            Inversiones &amp; Tecnología
          </span>
        ) : null}
      </div>
    </div>
  );
}
