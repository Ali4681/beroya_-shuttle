import type { ReactNode } from "react";
import "./globals.css";
import "./panel.css";
import "./landing.css";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return children;
}
