"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import {
  formPageBackLink,
  formPageDangerButton,
  formPageDangerButtonDisabled,
  formPageSaveButton,
  formPageSaveButtonDisabled,
} from "./app-action-buttons";

type Variant = "primary" | "danger" | "secondary";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  busy?: boolean;
  busyLabel?: string;
  variant?: Variant;
  children: ReactNode;
  style?: CSSProperties;
};

function buttonStyle(variant: Variant, inactive: boolean): CSSProperties {
  if (variant === "danger") {
    return inactive ? formPageDangerButtonDisabled() : formPageDangerButton();
  }
  if (variant === "secondary") {
    const base = formPageBackLink();
    return inactive ? { ...base, opacity: 0.55, cursor: "not-allowed" } : base;
  }
  return inactive ? formPageSaveButtonDisabled() : formPageSaveButton();
}

export function ButtonSpinner({
  size = 14,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      className="form-submit-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        fill={color}
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
      />
    </svg>
  );
}

/** Primary/danger submit button with loading spinner and disabled state. */
export default function FormSubmitButton({
  busy = false,
  busyLabel = "Menyimpan...",
  variant = "primary",
  disabled,
  children,
  style,
  type = "button",
  ...rest
}: Props) {
  const inactive = Boolean(busy || disabled);
  const spinnerColor = variant === "danger" ? "#991b1b" : variant === "secondary" ? "#64748b" : "#ffffff";

  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={busy || undefined}
      style={{
        ...buttonStyle(variant, inactive),
        gap: 8,
        ...style,
      }}
      {...rest}
    >
      {busy ? (
        <>
          <ButtonSpinner color={spinnerColor} />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
