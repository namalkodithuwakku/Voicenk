type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid place-items-center rounded-2xl bg-foreground shadow-lg ${
          compact ? "h-10 w-10" : "h-14 w-14"
        }`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          className={compact ? "h-6 w-6" : "h-8 w-8"}
          fill="none"
        >
          <path
            d="M7 17c2.2-5.8 4.5-5.8 6.7 0 2.2 5.8 4.5 5.8 6.7 0 1.1-2.9 2.2-4.3 3.6-4.3"
            stroke="#f59e0b"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div>
        <div
          className={`font-black tracking-[-0.04em] text-foreground ${
            compact ? "text-xl" : "text-3xl"
          }`}
        >
          Voicenk
        </div>
        {!compact && (
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
            Universal Voice Messenger
          </div>
        )}
      </div>
    </div>
  );
}
