// invoiceku/app/invoice/dotmatrix-button-client.tsx
"use client";

import { formPageSoftLink } from "../components/app-action-buttons";

export default function DotmatrixButtonClient({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={formPageSoftLink()}>
      Download Dotmatrix
    </a>
  );
}
