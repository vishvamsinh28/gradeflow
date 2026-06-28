import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GradeFlow — AI grading for teachers",
  description: "Upload student work, grade it against your answer keys and rubrics, review uncertain decisions, and understand class performance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        <style type="text/tailwindcss">{`
          @theme {
            --font-sans: "Inter", sans-serif;
            --font-display: "Space Grotesk", sans-serif;
            --font-mono: "JetBrains Mono", monospace;
            --color-navy: #0B1829;
            --color-navy-mid: #132338;
            --color-navy-light: #1E344F;
            --color-teal: #00C9A7;
            --color-teal-dim: #00A88C;
            --color-amber: #F59E0B;
            --color-slate: #8496B0;
            --color-cloud: #F8FAFC;
            --color-cloud-dim: #E2EAF4;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
