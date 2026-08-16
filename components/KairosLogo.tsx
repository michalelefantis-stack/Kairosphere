
import React from 'react';

interface KairosLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

const KairosLogo: React.FC<KairosLogoProps> = ({ className = "", size = 32, color = "#9fff00" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} filter drop-shadow-[0_0_8px_var(--k-glow)]`}
    >
      {/* Outer Sphere Frame */}
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />

      {/* Dynamic Orbital Ring */}
      <circle
        cx="50"
        cy="50"
        r="38"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="4 8"
        className="animate-[spin_20s_linear_infinite]"
        style={{ transformOrigin: 'center' }}
      />

      {/* The 'Kairos' Moment Axis */}
      <path
        d="M50 10V90M10 50H90"
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Central Prism (The Source of Truth) */}
      <path
        d="M50 30L65 50L50 70L35 50L50 30Z"
        fill={color}
        className="animate-pulse"
      />

      {/* Precision Markers */}
      <rect x="49" y="5" width="2" height="10" fill={color} />
      <rect x="49" y="85" width="2" height="10" fill={color} />
      <rect x="5" y="49" width="10" height="2" fill={color} />
      <rect x="85" y="49" width="10" height="2" fill={color} />

      {/* Inner Core Glow */}
      <circle cx="50" cy="50" r="4" fill={color} />
    </svg>
  );
};

export default KairosLogo;
