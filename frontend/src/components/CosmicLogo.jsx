export default function CosmicLogo({ size = 48, showText = true }) {
  const r = size / 2;
  const svgSize = size * (showText ? 2.2 : 1.1);
  const cx = svgSize / 2;
  const cy = showText ? r * 1.1 : cx;

  return (
    <svg
      width={svgSize}
      height={showText ? svgSize : svgSize}
      viewBox={`0 0 ${svgSize} ${showText ? svgSize : svgSize}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="lensGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#1a3a6e" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.6" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowStrong">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer orbit ring */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 0.95}
        ry={r * 0.95 * 0.3}
        fill="none"
        stroke="#00d4ff"
        strokeWidth="1.5"
        strokeOpacity="0.6"
        filter="url(#glow)"
      />

      {/* Inner lens / circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.65}
        fill="url(#lensGrad)"
        filter="url(#glowStrong)"
        strokeWidth="1.5"
        stroke="#00d4ff"
        strokeOpacity="0.8"
      />

      {/* Lens cross-hairs */}
      <line x1={cx - r * 0.65} y1={cy} x2={cx + r * 0.65} y2={cy} stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.4" />
      <line x1={cx} y1={cy - r * 0.65} x2={cx} y2={cy + r * 0.65} stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.4" />

      {/* Center star dot */}
      <circle cx={cx} cy={cy} r={r * 0.08} fill="#00d4ff" filter="url(#glowStrong)" />

      {/* Star spikes */}
      {[0, 45, 90, 135].map(angle => {
        const rad = (angle * Math.PI) / 180;
        const x2 = cx + Math.cos(rad) * r * 0.22;
        const y2 = cy + Math.sin(rad) * r * 0.22;
        const x3 = cx - Math.cos(rad) * r * 0.22;
        const y3 = cy - Math.sin(rad) * r * 0.22;
        return (
          <line key={angle} x1={x2} y1={y2} x2={x3} y2={y3}
            stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.9" filter="url(#glow)" />
        );
      })}

      {/* Orbit dot */}
      <circle
        cx={cx + r * 0.95}
        cy={cy}
        r={r * 0.07}
        fill="#7c3aed"
        filter="url(#glow)"
      />

      {/* Text */}
      {showText && (
        <>
          <text
            x={cx}
            y={cy + r * 1.35}
            textAnchor="middle"
            fontFamily="Orbitron, sans-serif"
            fontWeight="900"
            fontSize={r * 0.38}
            fill="#00d4ff"
            filter="url(#glow)"
            letterSpacing="3"
          >
            COSMIC
          </text>
          <text
            x={cx}
            y={cy + r * 1.72}
            textAnchor="middle"
            fontFamily="Orbitron, sans-serif"
            fontWeight="400"
            fontSize={r * 0.3}
            fill="#a78bfa"
            letterSpacing="6"
          >
            LENS
          </text>
        </>
      )}
    </svg>
  );
}
