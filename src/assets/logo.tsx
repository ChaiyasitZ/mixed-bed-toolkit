import React from 'react';

/**
 * Official KMUTT Logo Component
 * King Mongkut's University of Technology Thonburi (มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี)
 * Exact typography and 14-dot constellation mark in official KMUTT Orange (#F15A24)
 */
export const BrandLogo: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 40,
}) => {
  return (
    <div
      className={`rounded-xl bg-white p-1 flex items-center justify-center shadow-sm flex-shrink-0 border border-white/20 select-none overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="KMUTT - มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี"
    >
      <svg
        viewBox="0 0 255 265"
        className="w-full h-full object-contain"
        fill="#F15A24"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="KMUTT Logo"
      >
        {/* Constellation: 14 official KMUTT orange dots */}
        <g id="kmutt-dots">
          {/* Row 1 */}
          <circle cx="178" cy="38" r="5.8" />
          {/* Row 2 */}
          <circle cx="178" cy="56" r="5.8" />
          {/* Row 3 (4 dots) */}
          <circle cx="142" cy="74" r="5.8" />
          <circle cx="160" cy="74" r="5.8" />
          <circle cx="178" cy="74" r="5.8" />
          <circle cx="196" cy="74" r="5.8" />
          {/* Row 4 (2 dots) */}
          <circle cx="178" cy="92" r="5.8" />
          <circle cx="196" cy="92" r="5.8" />
          {/* Row 5 (4 dots) */}
          <circle cx="178" cy="110" r="5.8" />
          <circle cx="196" cy="110" r="5.8" />
          <circle cx="214" cy="110" r="5.8" />
          <circle cx="232" cy="110" r="5.8" />
          {/* Row 6 */}
          <circle cx="196" cy="128" r="5.8" />
          {/* Row 7 */}
          <circle cx="196" cy="146" r="5.8" />
        </g>

        {/* Letters Typography */}
        <g id="kmutt-letters">
          {/* K */}
          <path d="M 18 95 H 33 V 166 H 18 Z" />
          <path d="M 33 124 L 71 95 H 89 L 46 130 L 91 166 H 72 L 33 136 Z" />

          {/* M */}
          <path d="M 98 95 H 116 L 143 144 L 170 95 H 188 V 166 H 173 V 116 L 149 166 H 137 L 113 116 V 166 H 98 Z" />

          {/* U */}
          <path d="M 18 175 H 33 V 212 C 33 223 41 231 52 231 C 63 231 71 223 71 212 V 175 H 86 V 212 C 86 231 71 246 52 246 C 33 246 18 231 18 212 Z" />

          {/* First T */}
          <path d="M 95 175 H 142 V 189 H 126 V 246 H 111 V 189 H 95 Z" />

          {/* Second T */}
          <path d="M 146 175 H 193 V 189 H 177 V 246 H 162 V 189 H 146 Z" />
        </g>
      </svg>
    </div>
  );
};

export const BRAND_LOGO_SRC = '';
