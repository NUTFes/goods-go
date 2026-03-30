"use client";

import { ChevronRight, CircleUserRound, LogOut, Shield, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { logoutAction } from "@/features/auth/server/actions";
import { EVENT_DAY_OPTIONS, getRoleLabel } from "../model/mappers";

type UserTaskHeaderProps = {
  currentDay: "0" | "1" | "2";
  currentRole: AppRole;
  currentUserName: string;
  onDayChange: (day: "0" | "1" | "2") => void;
};

function isEventDay(value: string): value is "0" | "1" | "2" {
  return value === "0" || value === "1" || value === "2";
}

function roleIcon(role: AppRole) {
  if (role === APP_ROLES.ADMIN) {
    return <Shield className="size-4" />;
  }
  return <UserRound className="size-4" />;
}

type SwitchRowProps = {
  href: string;
  label: string;
  disabled: boolean;
  onNavigate: () => void;
};

function SwitchRow({ href, label, disabled, onNavigate }: SwitchRowProps) {
  const content = (
    <>
      <span>{label}</span>
      <ChevronRight className="size-4" aria-hidden="true" />
    </>
  );

  if (disabled) {
    return (
      <div
        className="flex min-h-11 items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[#595959]"
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-11 items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[#f5f5f5]"
    >
      {content}
    </Link>
  );
}

export function UserTaskHeader({
  currentDay,
  currentRole,
  currentUserName,
  onDayChange,
}: UserTaskHeaderProps) {
  const [open, setOpen] = useState(false);
  const disableUserSwitch = currentRole === APP_ROLES.USER;
  const disableAdminSwitch = currentRole !== APP_ROLES.ADMIN;

  return (
    <header className="bg-[#121212] text-[#fafafa]">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-6 pb-1 pt-4 sm:px-4">
        <div className="flex justify-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full p-0 text-[#e1e1e1] hover:bg-white/10 hover:text-white"
                aria-label="プロフィールを開く"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls="user-task-profile-popover"
              >
                <CircleUserRound className="size-8" strokeWidth={1.5} />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              id="user-task-profile-popover"
              align="end"
              sideOffset={12}
              className="w-[min(92vw,243px)] rounded-[10px] p-5"
            >
              <div className="space-y-3.25">
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpen(false)}
                      className="size-8 rounded-full hover:bg-[#f5f5f5]"
                      aria-label="プロフィールを閉じる"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="px-2">
                    <p className="flex items-baseline gap-1 text-xl leading-5 font-medium">
                      <span>{currentUserName}</span>
                      <span className="text-xs leading-none">さん</span>
                    </p>
                  </div>
                  <div className="rounded-lg px-2 py-1">
                    <p className="text-xs">あなたの現在の役割</p>
                    <div className="mt-1 flex items-center gap-2 text-base font-medium">
                      {roleIcon(currentRole)}
                      <span>{getRoleLabel(currentRole)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <SwitchRow
                    href="/tasks"
                    label="ユーザー画面に切り替え"
                    disabled={disableUserSwitch}
                    onNavigate={() => setOpen(false)}
                  />
                  <SwitchRow
                    href="/admin/tasks"
                    label="管理者画面に切り替え"
                    disabled={disableAdminSwitch}
                    onNavigate={() => setOpen(false)}
                  />
                </div>

                <Separator />

                <form action={logoutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="min-h-11 w-full justify-between hover:bg-[#f5f5f5]"
                  >
                    <span>ログアウト</span>
                    <LogOut className="size-4" aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Tabs
          value={currentDay}
          onValueChange={(value) => {
            if (isEventDay(value)) {
              onDayChange(value);
            }
          }}
          className="w-full gap-0"
        >
          <TabsList className="h-auto w-full gap-2 rounded-none bg-transparent p-0 sm:gap-4">
            {EVENT_DAY_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="h-10 flex-1 rounded-none border-x-0 border-t-0 border-b-4 border-transparent px-1 pb-3 font-bold text-[#e1e1e1] data-[state=active]:border-[#fafafa] data-[state=active]:bg-transparent data-[state=active]:text-[#fafafa] data-[state=active]:shadow-none"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </header>
  );
}
