import { z } from "zod";

const REQUIRED_NAME_ERROR = "名前を入力してください";
const NAME_LENGTH_ERROR = "名前は80文字以内で入力してください";

export const locationFormSchema = z.object({
  name: z
    .string({ error: REQUIRED_NAME_ERROR })
    .trim()
    .min(1, { error: REQUIRED_NAME_ERROR })
    .max(80, { error: NAME_LENGTH_ERROR }),
});

export type LocationFormInput = z.infer<typeof locationFormSchema>;
