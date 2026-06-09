"use client";

import { Toaster } from "sonner";

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "app-toast",
        },
      }}
    />
  );
}
