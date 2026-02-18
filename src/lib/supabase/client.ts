import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// NOTE:
// - ブラウザで使う前提のクライアント（anon key）
// - まずは会員登録/ログインなど「クライアント実行」で十分な範囲をここで扱う
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
