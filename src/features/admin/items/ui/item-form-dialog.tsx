"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Package } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { type ItemFormInput, itemFormSchema } from "../model/schema";
import type { AdminItem } from "../model/types";
import { createItemAction, updateItemAction } from "../server/actions";

type ItemFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  item?: AdminItem | null;
  onOpenChange: (open: boolean) => void;
};

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

function toDefaultValues(item?: AdminItem | null): ItemFormInput {
  return {
    name: item?.name ?? "",
  };
}

export function ItemFormDialog({ mode, open, item, onOpenChange }: ItemFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState("");

  const form = useForm<ItemFormInput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: toDefaultValues(item),
  });

  useEffect(() => {
    form.reset(toDefaultValues(item));
    form.clearErrors();
    setSubmitError("");
  }, [form, item, open]);

  const handleSubmit = form.handleSubmit((values) => {
    setSubmitError("");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createItemAction(values)
          : await updateItemAction(item?.itemId ?? "", values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [fieldName, messages] of Object.entries(result.fieldErrors)) {
            form.setError(fieldName as keyof ItemFormInput, {
              message: messages[0],
            });
          }
        }

        setSubmitError(result.message ?? "");
        return;
      }

      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "物品を追加" : "物品を編集"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" />
              物品情報
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="item-name" className="block text-xs font-normal text-zinc-500">
                物品名
              </Label>
              <Input
                id="item-name"
                placeholder="例：平台車"
                autoComplete="off"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </section>

          {submitError ? (
            <p className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="bg-black text-white hover:bg-zinc-800"
              disabled={isPending}
            >
              {isPending
                ? mode === "create"
                  ? "追加中..."
                  : "保存中..."
                : mode === "create"
                  ? "追加"
                  : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
