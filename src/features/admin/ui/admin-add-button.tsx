import { CirclePlus } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminAddButtonProps = ComponentProps<typeof Button>;

const adminAddButtonClass =
  "h-[52px] rounded-md bg-[#171717] px-3 py-4 text-sm font-normal text-[#fafafa] shadow-[0_1px_1px_rgba(0,0,0,0.1)] hover:bg-[#171717]/90";

export function AdminAddButton({ className, children, ...props }: AdminAddButtonProps) {
  return (
    <Button className={cn(adminAddButtonClass, className)} {...props}>
      <CirclePlus className="size-5" />
      {children}
    </Button>
  );
}
