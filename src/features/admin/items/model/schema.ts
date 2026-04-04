import { z } from "zod";

const REQUIRED_NAME_ERROR = "物品名を入力してください";
const NAME_LENGTH_ERROR = "物品名は100文字以内で入力してください";

export const itemFormSchema = z.object({
  name: z
    .string({ error: REQUIRED_NAME_ERROR })
    .trim()
    .min(1, { error: REQUIRED_NAME_ERROR })
    .max(100, { error: NAME_LENGTH_ERROR }),
});

export type ItemFormInput = z.infer<typeof itemFormSchema>;
