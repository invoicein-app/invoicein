// app/invoice/back-button-client.tsx
"use client";

import { formPageBackLink } from "../components/app-action-buttons";

export default function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/invoice";
        }
      }}
      style={formPageBackLink()}
    >
      Kembali
    </button>
  );
}
