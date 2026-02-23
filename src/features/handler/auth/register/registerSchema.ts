import { z } from "zod";

// メール要件:
// 数字2桁.小文字1文字.小文字列.nutfes@gmail.com
// 例) 12.a.kitano.nutfes@gmail.com
export const EMAIL_REGEX = /^\d{2}\.[a-z]\.[a-z]+\.nutfes@gmail\.com$/;

const NAME_MESSAGE = "氏名は3文字以上60文字以下で入力してください";
const EMAIL_MESSAGE = "正しい形式のメールアドレスにしてください";
const PASSWORD_MESSAGE = "パスワードは8文字以上の英数字で入力してください";

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(3, NAME_MESSAGE).max(60, NAME_MESSAGE),
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

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
