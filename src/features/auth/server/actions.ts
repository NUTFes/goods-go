"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "../model/schema";

// -- Action の戻り値の型 --
export type ActionState = {
  error: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function extractFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      if (!fieldErrors[key]) fieldErrors[key] = [];
      if (!fieldErrors[key].includes(issue.message)) {
        fieldErrors[key].push(issue.message);
      }
    }
  }
  return fieldErrors;
}

// -- ログイン --
export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "メールアドレスまたはパスワードが間違っています" };
  }

  redirect("/");
}

// -- 新規登録 --
export async function registerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "すでにメールアドレスが登録されています" };
    }
    return { error: "登録に失敗しました" };
  }

  // 現在のSupabase構成（autoConfirm=true）ではメール確認なしで即座にセッションが返る。
  // 万が一、将来的にメール確認を必須にした場合でも、セッションが無い場合はログイン画面へ誘導して
  // 「メールを確認してください」といったフローに対応できるようにしておく。
  if (!data.session) {
    redirect("/login");
  }

  redirect("/");
}

// -- ログアウト --
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
