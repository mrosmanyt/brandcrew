export function SupporterBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={
        className ||
        "inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground"
      }
    >
      Supporter
    </span>
  );
}
