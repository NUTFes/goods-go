"use client";

import { ChevronRight, CircleUserRound, LogOut, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/features/auth/server/actions";
import { APP_ROLES, getAppRoleLabel, type AppRole } from "@/lib/auth/roles";

type AdminHeaderProps = {
  currentUserName: string;
  currentUserRole: AppRole;
};

const navItems = [
  { href: "/admin/tasks", label: "タスク一覧", enabled: true },
  { href: "/admin/items", label: "物品一覧", enabled: true },
  { href: "/admin/locations", label: "場所一覧", enabled: false },
] as const;

type SwitchRowProps = {
  href: string;
  label: string;
  disabled: boolean;
  onNavigate: () => void;
};

function roleIcon(role: AppRole) {
  if (role === APP_ROLES.ADMIN) {
    return <Shield className="size-4" aria-hidden="true" />;
  }
  return <CircleUserRound className="size-4" aria-hidden="true" />;
}

function SwitchRow({ href, label, disabled, onNavigate }: SwitchRowProps) {
  const content = (
    <>
      <span>{label}</span>
      <ChevronRight className="size-4" aria-hidden="true" />
    </>
  );

  if (disabled) {
    return (
      <div className="flex min-h-11 items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[#595959]">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-11 items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[#171717] hover:bg-[#f5f5f5] focus-visible:ring-3 focus-visible:ring-[#121212]/20 focus-visible:ring-offset-2 focus-visible:outline-hidden motion-reduce:transition-none"
    >
      {content}
    </Link>
  );
}

export function AdminHeader({ currentUserName, currentUserRole }: AdminHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-15 w-full bg-zinc-900 text-white">
      <div className="mx-auto flex h-full w-full items-center justify-between px-8">
        <div className="flex h-full items-center gap-8">
          <Link href="/admin/tasks" className="text-lg font-bold">
            物品GO
          </Link>
          <nav className="flex h-full items-center">
            {navItems.map((item) => {
              if (!item.enabled) {
                return (
                  <span
                    key={item.href}
                    className="flex h-full items-center px-4 text-sm text-zinc-400"
                  >
                    {item.label}
                  </span>
                );
              }

              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "flex h-full items-center bg-zinc-800 px-4 text-sm font-medium"
                      : "flex h-full items-center px-4 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center text-sm">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full p-0 text-zinc-200 hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:ring-offset-0 focus-visible:outline-hidden motion-reduce:transition-none"
                aria-label="プロフィールを開く"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls="admin-profile-popover"
              >
                <CircleUserRound className="size-8" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              id="admin-profile-popover"
              align="end"
              sideOffset={12}
              className="w-[min(92vw,243px)] rounded-[10px] border border-[#e5e5e5] p-5 text-[#0a0a0a] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] motion-reduce:animate-none"
            >
              <div className="space-y-3.25">
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpen(false)}
                      className="size-8 rounded-full text-[#171717] hover:bg-[#f5f5f5] focus-visible:ring-3 focus-visible:ring-[#121212]/20 focus-visible:ring-offset-2 focus-visible:outline-hidden motion-reduce:transition-none"
                      aria-label="プロフィールを閉じる"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="px-2">
                    <p className="flex items-baseline gap-1 text-[20px] leading-5 font-medium text-[#0a0a0a]">
                      <span className="text-xl">{currentUserName}</span>
                      <span className="text-xs leading-none">さん</span>
                    </p>
                  </div>
                  <div className="rounded-lg px-2 py-1">
                    <p className="text-xs text-[#0a0a0a]">あなたの現在の役割</p>
                    <div className="mt-1 flex items-center gap-2 text-base font-medium text-[#0a0a0a]">
                      {roleIcon(currentUserRole)}
                      <span>{getAppRoleLabel(currentUserRole)}</span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-[#e5e5e5]" />

                <div className="space-y-2">
                  <SwitchRow
                    href="/tasks"
                    label="ユーザー画面に切り替え"
                    disabled={false}
                    onNavigate={() => setOpen(false)}
                  />
                  <SwitchRow
                    href="/admin/tasks"
                    label="管理者画面に切り替え"
                    disabled={currentUserRole !== APP_ROLES.ADMIN || pathname.startsWith("/admin")}
                    onNavigate={() => setOpen(false)}
                  />
                </div>

                <Separator className="bg-[#e5e5e5]" />

                <form action={logoutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="min-h-11 w-full justify-between rounded-lg px-2 py-1.5 text-sm font-normal text-[#0a0a0a] hover:bg-[#f5f5f5] motion-reduce:transition-none"
                  >
                    <span>ログアウト</span>
                    <LogOut className="size-4" aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
