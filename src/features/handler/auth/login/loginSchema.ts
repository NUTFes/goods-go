import { z } from "zod";

// 登録と同じ要件をログインでも使う（技大祭メール形式）
// 数字2桁.小文字1文字.小文字列.nutfes@gmail.com
export const EMAIL_REGEX = /^\d{2}\.[a-z]\.[a-z]+\.nutfes@gmail\.com$/;

const EMAIL_MESSAGE = "正しい形式のメールアドレスにしてください";
const PASSWORD_MESSAGE = "パスワードは８文字以上の英数字で入力してください";

export const LoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, EMAIL_MESSAGE)
    .regex(EMAIL_REGEX, EMAIL_MESSAGE),
  password: z
    .string()
    .min(8, PASSWORD_MESSAGE)
    .regex(/^[A-Za-z0-9]+$/, PASSWORD_MESSAGE),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
