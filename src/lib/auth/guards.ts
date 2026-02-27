import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { APP_ROLES, type AppRole, isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  userId: string;
  name: string;
  email: string | null;
  role: AppRole;
};

const getCurrentUserProfile = cache(
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

export async function requireUserWithRoles<
  const TRoles extends readonly AppRole[],
>(roles: TRoles): Promise<CurrentUserProfile & { role: TRoles[number] }> {
  const currentUser = await requireAuthenticatedUser();

  if (!roles.some((role) => role === currentUser.role)) {
    forbidden();
  }

  return currentUser as CurrentUserProfile & { role: TRoles[number] };
}

export async function requireAdminUser(): Promise<
  CurrentUserProfile & { role: typeof APP_ROLES.ADMIN }
> {
  return requireUserWithRoles([APP_ROLES.ADMIN] as const);
}
