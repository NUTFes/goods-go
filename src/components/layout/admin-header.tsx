"use client";

import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/features/auth/server/actions";

type AdminHeaderProps = {
  userName: string;
};

const navItems = [
  { href: "/admin/tasks", label: "タスク一覧", enabled: true },
  { href: "/admin/goods", label: "物品一覧", enabled: false },
  { href: "/admin/locations", label: "場所一覧", enabled: false },
] as const;

export function AdminHeader({ userName }: AdminHeaderProps) {
  const pathname = usePathname();

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

        <div className="flex items-center gap-5 text-sm">
          <div className="flex items-center gap-2">
            <CircleUserRound className="h-4 w-4" />
            <span>{userName}</span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 text-zinc-200 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>ログアウト</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
