"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BudgetStopDialog({
  open,
  onOpenChange,
  workspaceId,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  message: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This desk hit its generation budget</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Approved artifacts stay. New drafts pause until the cycle resets or
          you move to Starter ($20) or Pro ($79).
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stay on the desk
          </Button>
          <Button nativeButton={false} render={<Link href={`/desk/${workspaceId}/billing`} />}>
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
