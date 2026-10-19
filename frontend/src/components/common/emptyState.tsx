type EmptyStateProps = { title: string; description?: string };

/**
 * Clean inline empty-state — no dashed borders, no card wrappers.
 * Just muted typography that sits naturally inside its parent container.
 */
export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-5 text-slate-600">{description}</p>
      )}
    </div>
  );
}
