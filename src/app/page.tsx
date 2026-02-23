import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/guards";

export default async function Home() {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role === 0) {
    redirect("/admin/tasks");
  }

  redirect("/tasks");
}
