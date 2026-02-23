"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type ActionState,
  registerAction,
} from "@/features/auth/server/actions";

const initialState: ActionState = { error: "" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <>
      {messages.map((msg) => (
        <div key={msg} className="flex items-start gap-1 text-[#C91111]">
          <CircleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          <p className="text-xs leading-5">{msg}</p>
        </div>
      ))}
    </>
  );
}

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">アカウント作成</CardTitle>
        <CardDescription>
          メールアドレスとパスワードを入力してアカウントを作成してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-7" noValidate>
          {/* 氏名 */}
          <div className="space-y-3">
            <Label htmlFor="name">氏名</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="技大太郎"
              required
              minLength={3}
              maxLength={60}
              autoComplete="name"
              className="h-9"
              aria-invalid={!!state.fieldErrors?.name}
            />
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          {/* メール */}
          <div className="space-y-3">
            <Label htmlFor="email">メールアドレス（技大祭）</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="99.t.gidai.nutfes@gmail.com"
              required
              autoComplete="email"
              className="h-9"
              aria-invalid={!!state.fieldErrors?.email}
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>

          {/* パスワード */}
          <div className="space-y-3">
            <Label htmlFor="password">パスワード（8文字以上）</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="h-9 pr-10"
                aria-invalid={!!state.fieldErrors?.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "パスワードを隠す" : "パスワードを表示"
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
            <FieldError messages={state.fieldErrors?.password} />
          </div>

          {/* パスワード確認 */}
          <div className="space-y-3">
            <Label htmlFor="confirmPassword">パスワード（確認）</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-9"
              aria-invalid={!!state.fieldErrors?.confirmPassword}
            />
            <FieldError messages={state.fieldErrors?.confirmPassword} />
          </div>

          {/* Button + link */}
          <div className="space-y-3 pt-1">
            <Button
              type="submit"
              disabled={isPending}
              className="h-9 w-full rounded-[10px] bg-[#171717] text-[#FAFAFA] shadow-[0px_1px_2px_rgba(0,0,0,0.1)] hover:bg-[#171717]/90"
            >
              {isPending ? "作成中..." : "アカウントを作成"}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs leading-5 text-muted-foreground">
              <span>すでにアカウントをお持ちですか？</span>
              <Link href="/login" className="underline underline-offset-2">
                ログイン
              </Link>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
