"use client";

import type { ReactNode } from "react";
import { useGeoWhatsAppSalesUrl } from "@/components/marketing/use-geo-whatsapp-sales-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WhatsAppSalesButtonProps = {
  children: ReactNode;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  disabled?: boolean;
};

/** Opens geo-routed WhatsApp sales chat in a new tab. */
export function WhatsAppSalesButton({
  children,
  className,
  size = "lg",
  variant = "outline",
  disabled,
}: WhatsAppSalesButtonProps) {
  const href = useGeoWhatsAppSalesUrl();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(className)}
      disabled={disabled}
      nativeButton={false}
      render={
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      }
    />
  );
}
