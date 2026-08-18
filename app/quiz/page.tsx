import type { Metadata } from "next";
import QuizClient from "./QuizClient";

const TITLE = "Cinema IQ Test — ¿Qué tan cinéfilo eres? | Peekr";
const DESC =
  "Descubre tu arquetipo de espectador y tu Cinema IQ en 10 preguntas. Menos del 1% llega al nivel máximo. Gratis, 60 segundos, sin registro.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://peekr.app/quiz" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://peekr.app/quiz",
    siteName: "Peekr",
    images: ["/og/quiz"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og/quiz"],
  },
};

export default function QuizPage() {
  return <QuizClient />;
}
