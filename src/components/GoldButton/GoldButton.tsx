import type { ReactNode } from "react";
import "./GoldButton.css";

type GoldButtonProps = {
  children: ReactNode;
  // primary: 테두리 빛이 회전하는 주 버튼, subtle: 빛 없이 금색 선만 있는 보조 버튼
  variant?: "primary" | "subtle";
  className?: string;
};

function GoldButton({ children, variant = "primary", className = "" }: GoldButtonProps) {
  return (
    <button className={`gold-button gold-button--${variant} ${className}`} type="button">
      {children}
    </button>
  );
}

export default GoldButton;
