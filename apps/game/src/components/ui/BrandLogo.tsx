import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", size = "md" }) => {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-lg tracking-wider",
    md: "text-2xl tracking-widest",
    lg: "text-4xl tracking-widest",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/logo.png"
        alt="SCAMMAZE Isometric Logo"
        className={`${iconSizes[size]} object-contain drop-shadow-[0_0_12px_rgba(118,84,214,0.4)]`}
      />
      <div className="flex flex-col">
        <span
          className={`font-['Shojumaru',cursive] font-bold text-white leading-none ${textSizes[size]}`}
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7), 0 0 20px rgba(118,84,214,0.3)" }}
        >
          SCAMMAZE
        </span>
      </div>
    </div>
  );
};
