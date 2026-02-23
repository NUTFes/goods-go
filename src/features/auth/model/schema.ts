import { z } from "zod";

// ---------- 共通定数 ----------

// 技大祭メール形式: 数字2桁.小文字1文字.小文字列.nutfes@gmail.com
// 例: 12.a.kitano.nutfes@gmail.com
export const EMAIL_REGEX = /^\d{2}\.[a-z]\.[a-z]+\.nutfes@gmail\.com$/;

const EMAIL_MSG = "正しい形式のメールアドレスにしてください";
const PASSWORD_MSG = "パスワードは8文字以上の英数字で入力してください";
const NAME_MSG = "氏名は3文字以上60文字以下で入力してください";

// ---------- ログイン ----------

export const loginSchema = z.object({
  email: z.string().trim().max(254, EMAIL_MSG).regex(EMAIL_REGEX, EMAIL_MSG),
  password: z
    .string()
    .min(8, PASSWORD_MSG)
    .regex(/^[A-Za-z0-9]+$/, PASSWORD_MSG),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- 新規登録 ----------

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, NAME_MSG).max(60, NAME_MSG),
    email: z.string().trim().max(254, EMAIL_MSG).regex(EMAIL_REGEX, EMAIL_MSG),
    password: z
      .string()
      .min(8, PASSWORD_MSG)
      .regex(/^[A-Za-z0-9]+$/, PASSWORD_MSG),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;
