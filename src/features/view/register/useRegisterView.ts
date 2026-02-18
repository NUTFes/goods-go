"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";

import { supabase } from "@/lib/supabase/client";
import { createAuthRepository } from "../../repository/authRepository";
import {
  registerHandler,
  type RegisterResult,
} from "../../handler/auth/register/registerHandler";
import {
  RegisterInputSchema,
  type RegisterInput,
} from "../../handler/auth/register/registerSchema";
import {
  toAppAuthError,
  type AppAuthError,
} from "../../handler/auth/authErrors";

export type UseRegisterViewResult = {
  form: ReturnType<typeof useForm<RegisterInput>>;
  submit: SubmitHandler<RegisterInput>;
  error: AppAuthError | null;
  lastResult: RegisterResult | null;
};

export function useRegisterView(): UseRegisterViewResult {
  const repo = useMemo(() => createAuthRepository(supabase), []);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onSubmit",
  });

  const [error, setError] = useState<AppAuthError | null>(null);
  const [lastResult, setLastResult] = useState<RegisterResult | null>(null);

  const submit: SubmitHandler<RegisterInput> = async (values) => {
    setError(null);
    setLastResult(null);

    try {
      const res = await registerHandler(repo, values);
      setLastResult(res);
    } catch (e) {
      const appErr = toAppAuthError(e);

      // 既にメールアドレスが登録されている → email フィールドに表示（上部の共通エラーは出さない）
      if (appErr.kind === "already_registered") {
        form.setError("email", { type: "server", message: appErr.message });
        return;
      }

      setError(appErr);

      // それ以外は画面上部の共通エラーとして表示
      form.setError("root", { type: "server", message: appErr.message });
    }
  };

  return { form, submit, error, lastResult };
}
