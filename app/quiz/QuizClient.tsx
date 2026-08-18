"use client";

import { useMemo, useState } from "react";
import {
  QUESTIONS,
  computeResult,
  type QuizResult,
} from "./quiz-data";
import { buildResultImage, shareResultImage } from "./resultImage";

const MAGENTA = "#FA0082";
const GET_URL = "https://peekr.app/get?s=quiz&c=cinema_iq";
const IG_URL = "https://instagram.com/peekr.oficial";

type Stage = "intro" | "quiz" | "result";

export default function QuizClient() {
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [sharing, setSharing] = useState(false);

  const result: QuizResult | null = useMemo(
    () => (stage === "result" ? computeResult(answers) : null),
    [stage, answers],
  );

  function start() {
    setAnswers([]);
    setCurrent(0);
    setStage("quiz");
  }

  function pick(optIdx: number) {
    const next = [...answers];
    next[current] = optIdx;
    setAnswers(next);
    if (current + 1 < QUESTIONS.length) {
      setCurrent(current + 1);
    } else {
      setStage("result");
    }
  }

  async function onShare() {
    if (!result || sharing) return;
    setSharing(true);
    try {
      const blob = await buildResultImage(result);
      await shareResultImage(
        blob,
        `Mi Cinema IQ es ${result.iq} 🎬 Soy un ${result.archetype.name}. ¿Cuál es el tuyo? peekr.app/quiz`,
      );
    } catch {
      /* ignore */
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#0D0D0D] text-white flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-md flex-1 flex flex-col">
        {stage === "intro" && <Intro onStart={start} />}
        {stage === "quiz" && (
          <Quiz index={current} onPick={pick} />
        )}
        {stage === "result" && result && (
          <Result
            result={result}
            sharing={sharing}
            onShare={onShare}
            onRetry={start}
          />
        )}
      </div>
    </main>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center text-center gap-6">
      <div className="text-sm font-bold tracking-widest" style={{ color: MAGENTA }}>
        PEEKR · CINEMA IQ
      </div>
      <h1 className="text-4xl font-black leading-tight">
        ¿Qué tan alto es tu{" "}
        <span style={{ color: MAGENTA }}>Cinema IQ</span>?
      </h1>
      <p className="text-white/70 text-lg leading-relaxed">
        Descubre tu arquetipo de espectador en 10 preguntas.
        <br />
        <span className="text-white/90 font-semibold">
          Menos del 1% llega al nivel máximo.
        </span>
      </p>
      <button
        onClick={onStart}
        className="mt-2 w-full rounded-2xl py-4 text-lg font-extrabold text-white active:scale-[0.98] transition"
        style={{ backgroundColor: MAGENTA }}
      >
        Empezar test →
      </button>
      <div className="text-white/40 text-sm">Gratis · 60 segundos · sin registro</div>
    </div>
  );
}

function Quiz({
  index,
  onPick,
}: {
  index: number;
  onPick: (i: number) => void;
}) {
  const q = QUESTIONS[index];
  const pct = Math.round(((index) / QUESTIONS.length) * 100);
  return (
    <div className="flex-1 flex flex-col pt-4">
      <div className="flex items-center justify-between text-sm text-white/50 mb-2">
        <span>
          Pregunta {index + 1}/{QUESTIONS.length}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10 mb-8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: MAGENTA }}
        />
      </div>
      <h2 className="text-2xl font-black leading-snug mb-7">{q.q}</h2>
      <div className="flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className="text-left rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 text-[17px] font-semibold leading-snug active:scale-[0.99] hover:border-white/30 hover:bg-white/[0.07] transition"
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Result({
  result,
  sharing,
  onShare,
  onRetry,
}: {
  result: QuizResult;
  sharing: boolean;
  onShare: () => void;
  onRetry: () => void;
}) {
  const a = result.archetype;
  return (
    <div className="flex-1 flex flex-col gap-5 pt-2">
      {/* Archetype card */}
      <div
        className="rounded-3xl border border-white/10 px-6 py-8 text-center"
        style={{
          backgroundImage: `linear-gradient(160deg, ${a.grad[0]}, #0D0D0D)`,
        }}
      >
        <div className="text-7xl mb-3">{a.emoji}</div>
        <div className="text-sm font-bold tracking-widest text-white/60">ERES UN</div>
        <h1 className="text-3xl font-black leading-tight mt-1">{a.name}</h1>
        <p className="mt-2 italic font-semibold" style={{ color: MAGENTA }}>
          {a.tagline}
        </p>
        <p className="mt-4 text-white/70 text-[15px] leading-relaxed">{a.desc}</p>
      </div>

      {/* Cinema IQ */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-6 text-center">
        <div className="text-sm font-bold tracking-widest text-white/60">
          TU CINEMA IQ
        </div>
        <div className="text-7xl font-black my-1">{result.iq}</div>
        <div className="font-extrabold" style={{ color: MAGENTA }}>
          Solo {result.topPercent} llega a este nivel
        </div>
      </div>

      {/* CTAs */}
      <button
        onClick={onShare}
        disabled={sharing}
        className="w-full rounded-2xl py-4 text-lg font-extrabold text-white active:scale-[0.98] transition disabled:opacity-60"
        style={{ backgroundColor: MAGENTA }}
      >
        {sharing ? "Generando…" : "📸 Compartir mi resultado"}
      </button>
      <p className="text-center text-white/50 text-sm -mt-2">
        Súbelo a tus historias y etiqueta{" "}
        <span className="font-semibold text-white/80">@peekr.oficial</span>
      </p>

      <a
        href={GET_URL}
        className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-4 text-center text-lg font-extrabold active:scale-[0.98] transition"
      >
        📲 Descarga Peekr gratis
      </a>
      <a
        href={IG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-2xl border border-white/10 py-3 text-center font-semibold text-white/80 active:scale-[0.98] transition"
      >
        Sigue a @peekr.oficial
      </a>

      <button
        onClick={onRetry}
        className="text-center text-white/40 text-sm py-2"
      >
        ↻ Repetir test
      </button>
    </div>
  );
}
