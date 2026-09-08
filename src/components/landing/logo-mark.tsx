import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-full", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="47" stroke="url(#logo-ring)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="38" stroke="url(#logo-ring)" strokeWidth="1" opacity="0.6" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = 50 + Math.cos(angle) * 41;
        const y1 = 50 + Math.sin(angle) * 41;
        const x2 = 50 + Math.cos(angle) * 46;
        const y2 = 50 + Math.sin(angle) * 46;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#logo-ring)"
            strokeWidth="1.2"
          />
        );
      })}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="var(--font-playfair)"
        fontSize="34"
        fontWeight="700"
        fill="url(#logo-ring)"
      >
        P
      </text>
      <defs>
        <linearGradient id="logo-ring" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f3e4b8" />
          <stop offset="55%" stopColor="#c9a44c" />
          <stop offset="100%" stopColor="#e9d192" />
        </linearGradient>
      </defs>
    </svg>
  );
}
