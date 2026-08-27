type EmptyStateProps = {
  icon: string;
  title: string;
  message: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
