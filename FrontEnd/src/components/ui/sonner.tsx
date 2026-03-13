"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      <Sonner
        theme="dark"
        className="toaster group"
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            error: "error-toast",
          },
        }}
        {...props}
      />
      <style>{`
        .error-toast {
          background-color: #dc2626 !important; /* red-600 - vermelho forte */
          color: #ffffff !important;
          border: 2px solid #b91c1c !important; /* red-700 - borda mais escura */
          opacity: 1 !important;
          box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.4), 0 4px 6px -2px rgba(220, 38, 38, 0.3) !important;
          font-weight: 600 !important;
        }
        .error-toast [data-slot="title"] {
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .error-toast [data-slot="description"] {
          color: #fecaca !important; /* red-200 - texto mais claro para contraste */
        }
        .error-toast [data-slot="close-button"] {
          color: #ffffff !important;
        }
      `}</style>
    </>
  );
};

export { Toaster };
