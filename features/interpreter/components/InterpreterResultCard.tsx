import type { InterpreterResult } from "@/types/interpreter";

type InterpreterResultCardProps = {
  result: InterpreterResult;
  sourceLabel: string;
  targetLabel: string;
  isPlaying: boolean;
  onReplay: () => void;
  onStop: () => void;
  onClear: () => void;
};

export function InterpreterResultCard({
  result,
  sourceLabel,
  targetLabel,
  isPlaying,
  onReplay,
  onStop,
  onClear,
}: InterpreterResultCardProps) {
  return (
    <div className="mt-5 space-y-3">
      <article className="rounded-[1.6rem] bg-surface-soft p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Heard · {sourceLabel}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-black text-muted"
          >
            Clear
          </button>
        </div>
        <p className="mt-3 text-base font-extrabold leading-7 text-foreground">
          {result.transcript}
        </p>
      </article>

      <article className="rounded-[1.6rem] bg-foreground p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">
          Translation · {targetLabel}
        </p>
        <p className="mt-3 text-xl font-black leading-8 tracking-[-0.02em]">
          {result.translation}
        </p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={isPlaying ? onStop : onReplay}
            className="min-h-12 flex-1 rounded-2xl bg-accent px-4 font-black text-foreground"
          >
            {isPlaying ? "Stop voice" : "Play again"}
          </button>
        </div>
      </article>
    </div>
  );
}
