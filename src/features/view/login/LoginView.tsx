"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

import { useLoginView } from "./useLoginView";

// Figma CSS 寄せ
const COLOR_BG = "#F3F4F6";
const COLOR_BORDER = "#E5E5E5";
const COLOR_TEXT_SECONDARY = "#737373";
const COLOR_DELETE = "#C91111";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1" style={{ color: COLOR_DELETE }}>
      <CircleAlert className="h-3.5 w-3.5" />
      <p className="text-xs leading-5">{message}</p>
    </div>
  );
}

export function LoginView() {
  const router = useRouter();
  const { form, submit, error, lastResult } = useLoginView();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    formState: { isSubmitting, errors },
    handleSubmit,
  } = form;

  // ログイン成功後の遷移先（必要なら変更）
  useEffect(() => {
    if (lastResult?.kind === "signed_in") {
      router.replace("/");
    }
  }, [lastResult, router]);

  const rootMessage = errors.root?.message;

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center p-6"
      style={{ background: COLOR_BG }}
    >
      <div
        className="w-full max-w-[570px] rounded-xl bg-white"
        style={{
          border: `1px solid ${COLOR_BORDER}`,
          boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="flex flex-col items-center gap-6 py-6">
          {/* Header */}
          <div className="w-full px-6">
            <div className="flex flex-col items-start gap-3">
              <h1
                className="text-xl font-bold leading-6"
                style={{ color: "#0A0A0A" }}
              >
                ログイン
              </h1>
              <p
                className="text-sm leading-5"
                style={{ color: COLOR_TEXT_SECONDARY }}
              >
                メールアドレスとパスワードを入力してログインしてください
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="w-full px-6">
            {(rootMessage || error) && (
              <Alert variant="destructive">
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>
                  {rootMessage ?? error?.message}
                </AlertDescription>
              </Alert>
            )}

            <div
              className={cn("mt-4", rootMessage || error ? "mt-4" : "mt-0")}
            />

            <Form {...form}>
              <form onSubmit={handleSubmit(submit)} className="space-y-7">
                {/* Email */}
                <FormField
                  control={control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem className="space-y-3">
                      <FormLabel
                        className="text-sm font-medium leading-5"
                        style={{ color: "#0A0A0A" }}
                      >
                        メールアドレス（技大祭）
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Email"
                          {...field}
                          className={cn(
                            "h-9 rounded-lg border shadow-[0px_1px_2px_rgba(0,0,0,0.1)]",
                            fieldState.error
                              ? "border-[--delete]"
                              : "border-[--border]",
                          )}
                          style={
                            {
                              "--border": COLOR_BORDER,
                              "--delete": COLOR_DELETE,
                            } as React.CSSProperties
                          }
                        />
                      </FormControl>
                      <FieldError message={fieldState.error?.message} />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem className="space-y-3">
                      <div className="flex items-center justify-between">
                        <FormLabel
                          className="text-sm font-medium leading-5"
                          style={{ color: "#0A0A0A" }}
                        >
                          パスワード
                        </FormLabel>
                        <Link
                          href="/auth/forgot-password"
                          className="text-sm leading-5 text-foreground hover:opacity-80"
                        >
                          パスワードを忘れた場合
                        </Link>
                      </div>

                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="パスワードを入力"
                            {...field}
                            className={cn(
                              "h-9 rounded-md border pr-10 shadow-[0px_1px_2px_rgba(0,0,0,0.1)]",
                              fieldState.error
                                ? "border-[--delete]"
                                : "border-[--border]",
                            )}
                            style={
                              {
                                "--border": COLOR_BORDER,
                                "--delete": COLOR_DELETE,
                              } as React.CSSProperties
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={
                              showPassword
                                ? "パスワードを隠す"
                                : "パスワードを表示"
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                          >
                            {showPassword ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FieldError message={fieldState.error?.message} />
                    </FormItem>
                  )}
                />

                {/* Button + link */}
                <div className="space-y-3 pt-1">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 w-full rounded-[10px] bg-[#171717] text-[#FAFAFA] shadow-[0px_1px_2px_rgba(0,0,0,0.1)] hover:bg-[#171717]/90"
                  >
                    {isSubmitting ? "ログイン中..." : "ログイン"}
                  </Button>

                  <div
                    className="flex items-center justify-center gap-2 text-xs leading-5"
                    style={{ color: COLOR_TEXT_SECONDARY }}
                  >
                    <span>アカウントをお持ちでないですか？</span>
                    <Link
                      href="/auth/register"
                      className="underline underline-offset-2"
                    >
                      新規登録
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
