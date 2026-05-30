"use client";

import { formPagePrimaryLink } from "../components/app-action-buttons";

type Props = {
  href: string;
  label?: string;
};

export default function PdfButtonClient({ href, label = "Download PDF" }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      style={formPagePrimaryLink()}
    >
      {label}
    </button>
  );
}
