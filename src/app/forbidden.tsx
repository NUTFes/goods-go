import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-lg rounded-xl border bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-zinc-500">403 FORBIDDEN</p>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">
          このページへのアクセス権限がありません
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          管理者アカウントでログインしているか確認してください。
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/">トップへ戻る</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
