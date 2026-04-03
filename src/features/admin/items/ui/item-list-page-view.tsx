"use client";

import { CirclePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminItem } from "../model/types";
import { ItemDeleteDialog } from "./item-delete-dialog";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemTable } from "./item-table";

type ItemListPageViewProps = {
  items: AdminItem[];
};

export function ItemListPageView({ items }: ItemListPageViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdminItem | null>(null);

  return (
    <main className="px-16 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">物品一覧</h1>
            <p className="mt-1 text-sm text-zinc-500">タスクで使用する物品を管理します。</p>
          </div>
          <Button
            type="button"
            className="bg-black text-white hover:bg-zinc-800"
            onClick={() => setCreateOpen(true)}
          >
            <CirclePlus className="h-4 w-4" />
            物品を追加
          </Button>
        </div>

        <ItemTable
          items={items}
          onEdit={(item) => setEditingItem(item)}
          onDelete={(item) => setDeletingItem(item)}
        />
      </div>

      <ItemFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

      <ItemFormDialog
        mode="edit"
        open={editingItem !== null}
        item={editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
      />

      <ItemDeleteDialog
        open={deletingItem !== null}
        item={deletingItem}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      />
    </main>
  );
}
