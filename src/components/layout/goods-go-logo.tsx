import Image from "next/image";
import { cn } from "@/lib/utils";

type GoodsGoLogoProps = {
  className?: string;
};

export function GoodsGoLogo({ className }: GoodsGoLogoProps) {
  return (
    <Image
      src="/goods-go-logo.png"
      alt="Goods Go"
      width={603}
      height={191}
      className={cn("h-auto w-auto", className)}
      priority
    />
  );
}
