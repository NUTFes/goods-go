"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useState, useTransition } from "react";
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
import { type LocationFormInput, locationFormSchema } from "../model/schema";
import type { AdminLocation } from "../model/types";
import { createLocationAction, updateLocationAction } from "../server/actions";

type LocationFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  location?: AdminLocation | null;
  parentLocation?: AdminLocation | null;
  onOpenChange: (open: boolean) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="flex items-center gap-1 text-xs text-[#c91111]">
      <AlertCircle className="h-3.5 w-3.5" />
      {message}
    </p>
  );
}

function toDefaultValues(location?: AdminLocation | null): LocationFormInput {
  return {
    name: location?.name ?? "",
  };
}

function getCreateTitle(parentLocation?: AdminLocation | null) {
  if (!parentLocation) {
    return "新しいエリアを追加";
  }

  return `${parentLocation.name}に場所を追加`;
}

function getFieldLabel(mode: "create" | "edit", reference?: AdminLocation | null) {
  const depth = reference?.depth ?? -1;

  if (mode === "edit") {
    return depth <= 0 ? "エリア名" : "場所名";
  }

  if (depth < 0) {
    return "新しいエリア名";
  }

  if (depth === 0) {
    return "新しい階名";
  }

  return "新しい場所名";
}

function getPlaceholder(parentLocation?: AdminLocation | null) {
  if (!parentLocation) {
    return "例: 講義棟";
  }

  if (parentLocation.depth === 0) {
    return "1階";
  }

  return "例: 講義棟102";
}

export function LocationFormDialog({
  mode,
  open,
  location,
  parentLocation,
  onOpenChange,
}: LocationFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState("");

  const form = useForm<LocationFormInput>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: toDefaultValues(location),
  });

  const reference = mode === "edit" ? location : parentLocation;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset(toDefaultValues(location));
      form.clearErrors();
      setSubmitError("");
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit((values) => {
    setSubmitError("");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createLocationAction(parentLocation?.locationId ?? null, values)
          : await updateLocationAction(location?.locationId ?? "", values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [fieldName, messages] of Object.entries(result.fieldErrors)) {
            form.setError(fieldName as keyof LocationFormInput, { message: messages[0] });
          }
        }

        setSubmitError(result.message ?? "");
        return;
      }

      handleOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[512px] gap-0 rounded-[14px] border-none p-0 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
        showCloseButton={false}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-9 pt-9 pb-5">
            <DialogTitle className="border-b border-zinc-200 pb-3 text-left text-[20px] font-normal text-[#0a0a0a]">
              {mode === "create" ? getCreateTitle(parentLocation) : "エリアを編集"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1 px-9 pb-5">
            <Label htmlFor="location-name" className="text-sm font-normal leading-5 text-[#364153]">
              {getFieldLabel(mode, reference)}
            </Label>
            <Input
              id="location-name"
              placeholder={getPlaceholder(parentLocation)}
              autoComplete="off"
              className="h-[42px] rounded-[10px] border-zinc-300 px-3 text-base placeholder:text-black/50"
              {...form.register("name")}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          {submitError ? (
            <p className="flex items-center justify-center gap-1 px-9 pb-5 text-sm text-[#c91111]">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="gap-3 px-9 pb-9 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-[10px] px-4 text-sm font-normal text-[#364153] hover:bg-zinc-100"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="h-9 rounded-[10px] bg-[#0017c1] px-4 text-sm font-normal text-white hover:bg-[#0014ab]"
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
