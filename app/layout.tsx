import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protocolo Noturno",
  description: "Rotina e disciplina com um mentor de IA. Você não nasce disciplinado. Você treina até virar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
