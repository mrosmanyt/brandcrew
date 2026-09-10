import { connectorLogoSrc } from "@/lib/connector-logos";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "size-6",
  md: "size-8",
} as const;

const SIZE_PX = {
  sm: 24,
  md: 32,
} as const;

export function ConnectorLogo({
  pluginId,
  name,
  size = "md",
  className,
}: {
  pluginId: string;
  name?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const px = SIZE_PX[size];
  return (
    <img
      src={connectorLogoSrc(pluginId)}
      alt=""
      width={px}
      height={px}
      className={cn("shrink-0 rounded-md", SIZE_CLASS[size], className)}
      title={name}
      draggable={false}
    />
  );
}
