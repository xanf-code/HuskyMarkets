import { HuskyCoinIcon } from "@/components/icons/HuskyCoinIcon";
import { formatHC, formatHCNumber } from "@/lib/format";

interface HcAmountProps {
  amount: number;
  /** Icon edge length in px. */
  size?: number;
  className?: string;
}

/** Visual HuskyCoin amount: red H-coin + number (no "HC" suffix). */
export function HcAmount({ amount, size = 16, className = "" }: HcAmountProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={formatHC(amount)}
    >
      <HuskyCoinIcon size={size} />
      <span className="num" aria-hidden="true">
        {formatHCNumber(amount)}
      </span>
    </span>
  );
}
