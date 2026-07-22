interface HuskyCoinIconProps {
  size?: number;
  className?: string;
  /** When true (default), hide from assistive tech - pair with a labeled amount. */
  "aria-hidden"?: boolean | "true" | "false";
}

/** Manifold-style currency disc: red face, light rim/bevel, stylized H. */
export function HuskyCoinIcon({
  size = 16,
  className = "",
  "aria-hidden": ariaHidden = true,
}: HuskyCoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden={ariaHidden}
      focusable="false"
    >
      {/* Right-side bevel for a slight 3D disc */}
      <ellipse cx="17.5" cy="16" rx="12.5" ry="13" fill="#F2C4C9" />
      {/* Coin face */}
      <circle cx="15" cy="16" r="12.5" fill="#d41b2c" />
      {/* Inner rim */}
      <circle
        cx="15"
        cy="16"
        r="10.25"
        stroke="#F5D6DA"
        strokeWidth="1.25"
        fill="none"
      />
      {/* Stylized H with currency crossbars */}
      <path
        d="M10.2 9.5h2.15v4.35h5.3V9.5h2.15v13h-2.15v-4.55h-5.3V22.5H10.2V9.5z"
        fill="#F8E8EA"
      />
      <path
        d="M10.2 19.15h9.6M10.2 20.55h9.6"
        stroke="#F8E8EA"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}
