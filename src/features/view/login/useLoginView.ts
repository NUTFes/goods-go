"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";

import { supabase } from "@/lib/supabase/client";
import { createAuthRepository } from "../../repository/authRepository";
import {
  LoginInputSchema,
  type LoginInput,
} from "../../handler/auth/login/loginSchema";
import {
  loginHandler,
  type LoginResult,
} from "../../handler/auth/login/loginHandler";
import {
  toAppAuthError,
  type AppAuthError,
} from "../../handler/auth/authErrors";

export type UseLoginViewResult = {
  form: ReturnType<typeof useForm<LoginInput>>;
  submit: SubmitHandler<LoginInput>;
  error: AppAuthError | null;
  lastResult: LoginResult | null;
};

export function useLoginView(): UseLoginViewResult {
  const repo = useMemo(() => createAuthRepository(supabase), []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const [error, setError] = useState<AppAuthError | null>(null);
  const [lastResult, setLastResult] = useState<LoginResult | null>(null);

  const submit: SubmitHandler<LoginInput> = async (values) => {
    setError(null);
    setLastResult(null);

    try {
      const res = await loginHandler(repo, values);
      setLastResult(res);
    } catch (e) {
      const appErr = toAppAuthError(e);
      setError(appErr);
      form.setError("root", { type: "server", message: appErr.message });
    }
  };

  return { form, submit, error, lastResult };
}
