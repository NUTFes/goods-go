import { ZodError } from "zod";

/**
 * Supabase のエラーを UI で扱いやすい形に寄せるための型
 *
 * - validation: 入力バリデーション（Zod等）
 * - already_registered: 既に登録済み（メール重複など）
 * - invalid_credentials: ログイン失敗（ID/PW不一致）
 * - auth: 認証系（その他の Supabase Auth エラー）
 * - unknown: 想定外
 */
export type AppAuthError =
  | { kind: "validation"; message: string }
  | { kind: "already_registered"; message: string; status?: number }
  | { kind: "invalid_credentials"; message: string; status?: number }
  | { kind: "auth"; message: string; status?: number }
  | { kind: "unknown"; message: string };

type MessageStatusLike = {
  message: string;
  status?: number;
  code?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asMessageStatusLike(e: unknown): MessageStatusLike | null {
  if (!isRecord(e)) return null;

  const message = typeof e.message === "string" ? e.message : undefined;
  if (!message) return null;

  const status = typeof e.status === "number" ? e.status : undefined;
  const code = typeof e.code === "string" ? e.code : undefined;

  return { message, status, code };
}

function isAlreadyRegistered(message: string, code?: string): boolean {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();

  return (
    m.includes("user already registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("already exists") ||
    // code で来る可能性もあるので念のため
    c.includes("already") ||
    c.includes("exists")
  );
}

function isInvalidCredentials(message: string, code?: string): boolean {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();

  return (
    m.includes("invalid login credentials") ||
    m.includes("invalid_credentials") ||
    c === "invalid_credentials"
  );
}

export function toAppAuthError(e: unknown): AppAuthError {
  // zod
  if (e instanceof ZodError) {
    const message = e.issues?.[0]?.message ?? "入力内容を確認してください";
    return { kind: "validation", message };
  }

  // supabase-js error は通常 { message, status, code? }
  const ms = asMessageStatusLike(e);
  if (ms) {
    if (isAlreadyRegistered(ms.message, ms.code)) {
      return {
        kind: "already_registered",
        message: "すでにメールアドレスが登録されています",
        status: ms.status,
      };
    }

    if (isInvalidCredentials(ms.message, ms.code)) {
      return {
        kind: "invalid_credentials",
        message: "メールアドレスまたはパスワードが間違っています",
        status: ms.status,
      };
    }

    return {
      kind: "auth",
      message: ms.message || "認証に失敗しました",
      status: ms.status,
    };
  }

  return { kind: "unknown", message: "予期しないエラーが発生しました" };
}
