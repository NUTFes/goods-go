"use client";

import { CirclePlus, FoldVertical, UnfoldVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminLocation } from "../model/types";
import { LocationDeleteDialog } from "./location-delete-dialog";
import { LocationFormDialog } from "./location-form-dialog";
import { LocationTree } from "./location-tree";

type LocationListPageViewProps = {
  locations: AdminLocation[];
};

function collectExpandableIds(locations: AdminLocation[]): string[] {
  return locations.flatMap((location) => [
    ...(location.children.length > 0 ? [location.locationId] : []),
    ...collectExpandableIds(location.children),
  ]);
}

export function LocationListPageView({ locations }: LocationListPageViewProps) {
  const expandableIds = useMemo(() => collectExpandableIds(locations), [locations]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(expandableIds));
  const [createRootOpen, setCreateRootOpen] = useState(false);
  const [parentLocation, setParentLocation] = useState<AdminLocation | null>(null);
  const [editingLocation, setEditingLocation] = useState<AdminLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<AdminLocation | null>(null);

  useEffect(() => {
    setExpandedIds((current) => {
      if (current.size === 0) {
        return new Set(expandableIds);
      }

      const allowed = new Set(expandableIds);
      return new Set([...current].filter((id) => allowed.has(id)));
    });
  }, [expandableIds]);

  return (
    <main className="px-6 py-6 md:px-16 md:py-8">
      <div className="mx-auto max-w-[876px] space-y-4">
        <h1 className="sr-only">場所一覧</h1>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-[52px] rounded-[10px] bg-black px-4 text-sm font-normal text-white hover:bg-zinc-800"
            onClick={() => setCreateRootOpen(true)}
          >
            <CirclePlus className="h-4 w-4" />
            エリアを追加
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[10px] border-zinc-300 bg-white px-3 text-xs font-normal text-zinc-700"
            onClick={() => setExpandedIds(new Set(expandableIds))}
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
            全て展開
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[10px] border-zinc-300 bg-white px-3 text-xs font-normal text-zinc-700"
            onClick={() => setExpandedIds(new Set())}
          >
            <FoldVertical className="h-3.5 w-3.5" />
            折りたたむ
          </Button>
        </div>

        <LocationTree
          locations={locations}
          expandedIds={expandedIds}
          onExpandedChange={(locationId, open) => {
            setExpandedIds((current) => {
              const next = new Set(current);

              if (open) {
                next.add(locationId);
              } else {
                next.delete(locationId);
              }

              return next;
            });
          }}
          onCreateChild={(location) => setParentLocation(location)}
          onEdit={(location) => setEditingLocation(location)}
          onDelete={(location) => setDeletingLocation(location)}
        />
      </div>

      <LocationFormDialog
        key={parentLocation?.locationId ?? "location-create-root"}
        mode="create"
        open={createRootOpen || parentLocation !== null}
        parentLocation={parentLocation}
        onOpenChange={(open) => {
          if (!open) {
            setCreateRootOpen(false);
            setParentLocation(null);
          }
        }}
      />

      <LocationFormDialog
        key={editingLocation?.locationId ?? "location-edit-empty"}
        mode="edit"
        open={editingLocation !== null}
        location={editingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setEditingLocation(null);
          }
        }}
      />

      <LocationDeleteDialog
        key={deletingLocation?.locationId ?? "location-delete-empty"}
        open={deletingLocation !== null}
        location={deletingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingLocation(null);
          }
        }}
      />
    </main>
  );
}
