import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageConversionSpike } from "@/features/task-photos/ui/image-conversion-spike";

export const metadata: Metadata = {
  title: "画像変換検証 | Goods Go",
  description: "Issue #102のBrowser画像変換を実機確認する開発専用ページ",
};

export default function ImageConversionSpikePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <ImageConversionSpike />;
}
