import { consoleAppHref } from "@/lib/console-site";

export function ConsoleNavLink({
  workspaceId,
  className,
  children,
  title,
}: {
  workspaceId: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const href = consoleAppHref({ workspaceId });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={className}
    >
      {children}
    </a>
  );
}
