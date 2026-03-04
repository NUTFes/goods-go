import { z } from "zod";

const REQUIRED_SELECT_ERROR = "選択してください";
const QUANTITY_ERROR = "1以上選択してください";
const TIME_RANGE_ERROR = "終了時刻は開始時刻より後の時間を指定してください";
const DUPLICATED_LOCATION_ERROR = "搬入元と搬入先には異なる場所を指定してください";

const requiredSelect = z
  .string({ error: REQUIRED_SELECT_ERROR })
  .trim()
  .min(1, { error: REQUIRED_SELECT_ERROR });

const timeValueSchema = z.iso.time({ error: REQUIRED_SELECT_ERROR });

function toMinutes(timeValue: string): number {
  const [hour, minute] = timeValue.split(":").map(Number);
  return hour * 60 + minute;
}

export const taskFormSchema = z
  .object({
    eventDayType: z.number({ error: REQUIRED_SELECT_ERROR }).min(0).max(2),
    currentStatus: z.number({ error: REQUIRED_SELECT_ERROR }).min(0).max(2),
    leaderUserId: requiredSelect,
    fromLocationId: requiredSelect,
    toLocationId: requiredSelect,
    itemId: requiredSelect,
    quantity: z.number({ error: QUANTITY_ERROR }).int().min(1),
    scheduledStartTime: timeValueSchema,
    scheduledEndTime: timeValueSchema,
    note: z.string({ error: "1000文字以内で入力してください" }).trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.fromLocationId === value.toLocationId) {
      context.addIssue({
        code: "custom",
        path: ["toLocationId"],
        message: DUPLICATED_LOCATION_ERROR,
      });
    }

    if (toMinutes(value.scheduledEndTime) <= toMinutes(value.scheduledStartTime)) {
      context.addIssue({
        code: "custom",
        path: ["scheduledEndTime"],
        message: TIME_RANGE_ERROR,
      });
    }
  });

export type TaskFormInput = z.infer<typeof taskFormSchema>;
