"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Replaces the root layout - must include html/body. Keep styles inline so
  // this still works if the design-system CSS fails to load.
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            '"Hanken Grotesk", "Helvetica Neue", Arial, sans-serif',
          background: "#f5f6f8",
          color: "#0a0a0a",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#d41b2c",
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            HuskyMarkets hit a snag
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "#5c6370",
            }}
          >
            Reload the page to get back on the board. Your account and balances
            are unaffected.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              minHeight: "2.75rem",
              padding: "0.625rem 1rem",
              border: "none",
              borderRadius: "8px",
              background: "#d41b2c",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
