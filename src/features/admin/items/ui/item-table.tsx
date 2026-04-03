"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminItem } from "../model/types";

type ItemTableProps = {
  items: AdminItem[];
  onEdit: (item: AdminItem) => void;
  onDelete: (item: AdminItem) => void;
};

export function ItemTable({ items, onEdit, onDelete }: ItemTableProps) {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-zinc-200">
      <Table className="table-fixed">
        <TableHeader className="[&_tr]:border-none">
          <TableRow className="bg-zinc-900 hover:bg-zinc-900 [&>th]:px-4">
            <TableHead className="h-11 text-center text-white first:rounded-tl-lg">物品名</TableHead>
            <TableHead className="h-11 w-12 min-w-12 px-2 text-center text-white">編集</TableHead>
            <TableHead className="h-11 w-12 min-w-12 px-2 text-center text-white last:rounded-tr-lg">削除</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.itemId} className="bg-white hover:bg-transparent [&>td]:px-4">
              <TableCell className="text-center font-medium">{item.name}</TableCell>
              <TableCell className="px-2 text-center">
                <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="編集">
                  <Pencil className="h-4 w-4 text-green-600" aria-hidden="true" />
                </Button>
              </TableCell>
              <TableCell className="px-2 text-center">
                <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item)} aria-label="削除">
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow className="bg-white hover:bg-transparent">
              <TableCell colSpan={3} className="py-12 text-center text-sm text-zinc-500">
                登録されている物品はありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
