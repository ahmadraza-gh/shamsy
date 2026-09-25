"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f6f8", color: "#172033", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <title>Application error · Shamsy</title>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "2rem" }}>
          <section style={{ maxWidth: "32rem", border: "1px solid #dbe2ea", borderRadius: "1rem", background: "white", padding: "2rem", textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>The application could not be loaded</h1>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              Please try again. If the problem continues, contact your administrator.
            </p>
            <button
              onClick={retry}
              style={{ minHeight: "2.75rem", border: 0, borderRadius: "0.7rem", background: "#172c58", color: "white", cursor: "pointer", font: "inherit", fontWeight: 650, padding: "0.7rem 1rem" }}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
