import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthRepository = {
  signUp: (args: {
    email: string;
    password: string;
    name: string;
  }) => Promise<{ user: unknown | null; session: unknown | null }>;

  signInWithPassword: (args: {
    email: string;
    password: string;
  }) => Promise<{ user: unknown | null; session: unknown | null }>;
};

export function createAuthRepository(supabase: SupabaseClient): AuthRepository {
  return {
    async signUp({ email, password, name }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      if (error) throw error;
      return { user: data.user, session: data.session };
    },

    async signInWithPassword({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { user: data.user, session: data.session };
    },
  };
}
