import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Goods Go",
  description: "NUTFesの物品管理アプリケーション",
};

export default async function Home() {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role === 0) {
    redirect("/admin/tasks");
  }

  redirect("/tasks");
}
