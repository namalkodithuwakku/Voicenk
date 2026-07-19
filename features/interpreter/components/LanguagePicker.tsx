"use client";

import { useMemo, useState } from "react";
import { languages } from "@/lib/languages";

type LanguagePickerProps = {
  open: boolean;
  title: string;
  selectedCode: string;
  allowAutoDetect?: boolean;
  onSelect: (code: string) => void;
  onClose: () => void;
};

export function LanguagePicker({
  open,
  title,
  selectedCode,
  allowAutoDetect = false,
  onSelect,
  onClose,
}: LanguagePickerProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return languages;

    return languages.filter(
      (language) =>
        language.name.toLowerCase().includes(normalized) ||
        language.nativeName.toLowerCase().includes(normalized),
    );
  }, [query]);

  if (!open) return null;

  function choose(code: string) {
    onSelect(code);
    setQuery("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="safe-bottom flex max-h-[86dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-surface p-5 shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
              Language
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-surface-soft text-xl"
            aria-label="Close language picker"
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all languages"
          className="mt-5 min-h-12 rounded-2xl bg-surface-soft px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-accent/30"
        />

        <div className="mt-4 overflow-y-auto rounded-2xl border border-border">
          {allowAutoDetect && !query && (
            <LanguageRow
              name="Auto detect"
              nativeName="Let Voicenk identify the language"
              selected={selectedCode === "auto"}
              onClick={() => choose("auto")}
            />
          )}

          {results.map((language) => (
            <LanguageRow
              key={language.code}
              name={language.name}
              nativeName={language.nativeName}
              selected={selectedCode === language.code}
              onClick={() => choose(language.code)}
            />
          ))}

          {results.length === 0 && (
            <p className="p-6 text-center text-sm font-bold text-muted">
              No language found.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function LanguageRow({
  name,
  nativeName,
  selected,
  onClick,
}: {
  name: string;
  nativeName: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-b-0 ${
        selected ? "bg-accent-soft" : "bg-surface"
      }`}
    >
      <span>
        <span className="block text-sm font-black">{name}</span>
        <span className="block text-xs font-semibold text-muted">
          {nativeName}
        </span>
      </span>
      {selected && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-black">
          ✓
        </span>
      )}
    </button>
  );
}
