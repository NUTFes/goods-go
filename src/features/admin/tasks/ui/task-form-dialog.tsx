"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Clock3, MapPin, NotebookPen, Package, Triangle } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_DAY_OPTIONS, STATUS_OPTIONS } from "../model/mappers";
import { type TaskFormInput, taskFormSchema } from "../model/schema";
import type { AdminTask, TaskFilterOptions } from "../model/types";
import { createTaskAction, updateTaskAction } from "../server/actions";

type TaskFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  task?: AdminTask | null;
  filterOptions: TaskFilterOptions;
  onOpenChange: (open: boolean) => void;
};

type TaskForm = UseFormReturn<TaskFormInput>;
type LocationGroups = Record<string, TaskFilterOptions["locations"]>;

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="h-3.5 w-3.5" />
      {message}
    </p>
  );
}

function toDefaultValues(task?: AdminTask | null): TaskFormInput {
  if (!task) {
    return {
      eventDayType: 0,
      currentStatus: 0,
      leaderUserId: "",
      fromLocationId: "",
      toLocationId: "",
      itemId: "",
      quantity: 1,
      scheduledStartTime: "",
      scheduledEndTime: "",
      note: "",
    };
  }

  return {
    eventDayType: task.eventDayType,
    currentStatus: task.currentStatus,
    leaderUserId: task.leaderUserId ?? "",
    fromLocationId: task.fromLocationId,
    toLocationId: task.toLocationId,
    itemId: task.itemId,
    quantity: task.quantity,
    scheduledStartTime: task.scheduledStartTime,
    scheduledEndTime: task.scheduledEndTime,
    note: task.note ?? "",
  };
}

function groupedOptions(options: TaskFilterOptions["locations"]): LocationGroups {
  return options.reduce<LocationGroups>((acc, option) => {
    if (!acc[option.group]) {
      acc[option.group] = [];
    }
    acc[option.group].push(option);
    return acc;
  }, {});
}

function TaskBasicSection({
  form,
  filterOptions,
}: {
  form: TaskForm;
  filterOptions: TaskFilterOptions;
}) {
  const eventDayType = useWatch({
    control: form.control,
    name: "eventDayType",
  });
  const currentStatus = useWatch({
    control: form.control,
    name: "currentStatus",
  });
  const leaderUserId = useWatch({
    control: form.control,
    name: "leaderUserId",
  });

  return (
    <section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">日付選択</Label>
          <Select
            value={String(eventDayType ?? 0)}
            onValueChange={(value) =>
              form.setValue("eventDayType", Number(value), {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_DAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.eventDayType?.message} />
        </div>

        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">ステータス</Label>
          <Select
            value={String(currentStatus ?? 0)}
            onValueChange={(value) =>
              form.setValue("currentStatus", Number(value), {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.currentStatus?.message} />
        </div>

        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">指揮者</Label>
          <Select
            value={leaderUserId ?? ""}
            onValueChange={(value) =>
              form.setValue("leaderUserId", value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.leaders.map((leader) => (
                <SelectItem key={leader.value} value={leader.value}>
                  {leader.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.leaderUserId?.message} />
        </div>
      </div>
    </section>
  );
}

function TaskLocationSection({
  form,
  locationGroups,
}: {
  form: TaskForm;
  locationGroups: LocationGroups;
}) {
  const fromLocationId = useWatch({
    control: form.control,
    name: "fromLocationId",
  });
  const toLocationId = useWatch({
    control: form.control,
    name: "toLocationId",
  });

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4" />
        場所
      </h3>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">From（搬入元）</Label>
          <Select
            value={fromLocationId ?? ""}
            onValueChange={(value) =>
              form.setValue("fromLocationId", value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(locationGroups).map(([groupName, options]) => (
                <SelectGroup key={groupName}>
                  <SelectLabel>{groupName}</SelectLabel>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.fromLocationId?.message} />
        </div>

        <div className="pt-8 text-zinc-400">
          <Triangle className="h-4 w-4 rotate-90 fill-current" />
        </div>

        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">To（搬入先）</Label>
          <Select
            value={toLocationId ?? ""}
            onValueChange={(value) =>
              form.setValue("toLocationId", value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(locationGroups).map(([groupName, options]) => (
                <SelectGroup key={groupName}>
                  <SelectLabel>{groupName}</SelectLabel>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.toLocationId?.message} />
        </div>
      </div>
    </section>
  );
}

function TaskItemSection({
  form,
  filterOptions,
}: {
  form: TaskForm;
  filterOptions: TaskFilterOptions;
}) {
  const itemId = useWatch({
    control: form.control,
    name: "itemId",
  });

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4" />
        物品
      </h3>
      <div className="space-y-1.5">
        <Label className="block text-xs text-zinc-500 font-normal">物品名・数量選択</Label>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Select
              value={itemId ?? ""}
              onValueChange={(value) => form.setValue("itemId", value, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="物品名" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={form.formState.errors.itemId?.message} />
          </div>

          <div className="space-y-1.5">
            <Input
              type="number"
              min={1}
              placeholder="個数"
              {...form.register("quantity", {
                valueAsNumber: true,
              })}
            />
            <FieldError message={form.formState.errors.quantity?.message} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskScheduleSection({
  form,
  filterOptions,
}: {
  form: TaskForm;
  filterOptions: TaskFilterOptions;
}) {
  const scheduledStartTime = useWatch({
    control: form.control,
    name: "scheduledStartTime",
  });
  const scheduledEndTime = useWatch({
    control: form.control,
    name: "scheduledEndTime",
  });

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Clock3 className="h-4 w-4" />
        予定時刻
      </h3>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">予定開始時刻</Label>
          <Select
            value={scheduledStartTime ?? ""}
            onValueChange={(value) =>
              form.setValue("scheduledStartTime", value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filterOptions.timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.scheduledStartTime?.message} />
        </div>

        <div className="pt-8 text-zinc-400">
          <Triangle className="h-4 w-4 rotate-90 fill-current" />
        </div>

        <div className="space-y-1.5">
          <Label className="block text-xs text-zinc-500 font-normal">予定終了時刻</Label>
          <Select
            value={scheduledEndTime ?? ""}
            onValueChange={(value) =>
              form.setValue("scheduledEndTime", value, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filterOptions.timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={form.formState.errors.scheduledEndTime?.message} />
        </div>
      </div>
    </section>
  );
}

function TaskNoteSection({ form }: { form: TaskForm }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <NotebookPen className="h-4 w-4" />
        タスク備考
      </h3>
      <Textarea
        className="resize-none h-24"
        placeholder={`補足があれば記入してください\n例：駐車場設営`}
        {...form.register("note")}
      />
      <FieldError message={form.formState.errors.note?.message} />
    </section>
  );
}

export function TaskFormDialog({
  mode,
  open,
  task,
  filterOptions,
  onOpenChange,
}: TaskFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string>("");

  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toDefaultValues(task),
  });

  const locationGroups = useMemo(
    () => groupedOptions(filterOptions.locations),
    [filterOptions.locations],
  );

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSubmitError("");
    }

    onOpenChange(nextOpen);
  };

  useEffect(() => {
    form.reset(toDefaultValues(task));
  }, [form, task]);

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError("");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTaskAction(values)
          : await updateTaskAction(task?.taskId ?? "", values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [fieldName, messages] of Object.entries(result.fieldErrors)) {
            if (!messages || messages.length === 0) {
              continue;
            }
            form.setError(fieldName as keyof TaskFormInput, {
              message: messages[0],
            });
          }
        }

        if (result.message) {
          setSubmitError(result.message);
        }
        return;
      }

      handleDialogOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-176 sm:max-w-176 rounded-2xl p-9" showCloseButton={false}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle>{mode === "create" ? "タスクを追加" : "タスクを編集"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-8">
          <TaskBasicSection form={form} filterOptions={filterOptions} />

          <TaskLocationSection form={form} locationGroups={locationGroups} />

          <TaskItemSection form={form} filterOptions={filterOptions} />

          <TaskScheduleSection form={form} filterOptions={filterOptions} />

          <TaskNoteSection form={form} />

          {submitError ? (
            <p className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isPending}
            >
              {isPending ? "保存中..." : mode === "create" ? "追加" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
