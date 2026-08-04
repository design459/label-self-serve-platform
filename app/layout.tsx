import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Label Workspace",
  description: "Self-serve label design for AN/SFC private-label customers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
