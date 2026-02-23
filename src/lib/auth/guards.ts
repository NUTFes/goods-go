import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = 0 | 1 | 2;

export type CurrentUserProfile = {
  userId: string;
  name: string;
  email: string | null;
  role: AppRole;
};

function isAppRole(value: unknown): value is AppRole {
  return value === 0 || value === 1 || value === 2;
}

export const getCurrentUserProfile = cache(
  async (): Promise<CurrentUserProfile | null> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    const userId =
      typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    if (!userId) {
      return null;
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("user_id,name,email,role,deleted")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !user || user.deleted !== null || !isAppRole(user.role)) {
      return null;
    }

    return {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  },
);

export async function requireAuthenticatedUser(): Promise<CurrentUserProfile> {
  const currentUser = await getCurrentUserProfile();

  if (!currentUser) {
    redirect("/login");
  }

  return currentUser;
}

export async function requireAdminUser(): Promise<
  CurrentUserProfile & { role: 0 }
> {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role !== 0) {
    forbidden();
  }

  return {
    ...currentUser,
    role: 0,
  };
}
