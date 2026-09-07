import { DeskThemeToggle } from "@/components/desk/theme-toggle";

export function DeskChromeHeader() {
  return (
    <header className="hidden h-11 shrink-0 items-center justify-end border-b border-border bg-background px-4 md:flex">
      <DeskThemeToggle />
    </header>
  );
}
