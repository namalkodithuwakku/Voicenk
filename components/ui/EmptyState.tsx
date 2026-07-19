type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  icon,
}: EmptyStateProps) {
  return (
    <section className="flex min-h-[68vh] flex-col justify-center py-8">
      <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
          {icon}
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
          {eyebrow}
        </p>
        <h1 className="max-w-xs text-3xl font-black leading-tight tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-muted">
          {description}
        </p>
      </div>
    </section>
  );
}
