import React from "react";

interface BidPulseLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  variant?: "full" | "mark";
  onClick?: () => void;
}

export const BidPulseLogo: React.FC<BidPulseLogoProps> = ({
  className = "",
  size = "md",
  showTagline = false,
  variant = "full",
  onClick,
}) => {
  const heightClass =
    size === "sm"
      ? "h-7"
      : size === "md"
      ? "h-9"
      : size === "lg"
      ? "h-11"
      : "h-14";

  if (variant === "mark") {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
      >
        <img
          src="/favicon.svg"
          alt="BidPulse — Real-Time Bidding. Instant Results."
          className={`${heightClass} w-auto object-contain`}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <img
        src="/bidpulse-logo.svg"
        alt="BidPulse — Real-Time Bidding. Instant Results."
        className={`${heightClass} w-auto object-contain`}
      />
    </div>
  );
};
