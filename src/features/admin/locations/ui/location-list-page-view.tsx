"use client";

import { CirclePlus, FoldVertical, UnfoldVertical } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
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

type DialogState = {
  createRootOpen: boolean;
  parentLocation: AdminLocation | null;
  editingLocation: AdminLocation | null;
  deletingLocation: AdminLocation | null;
};

type DialogAction =
  | { type: "open-create-root" }
  | { type: "open-create-child"; location: AdminLocation }
  | { type: "open-edit"; location: AdminLocation }
  | { type: "open-delete"; location: AdminLocation }
  | { type: "close-create" }
  | { type: "close-edit" }
  | { type: "close-delete" };

const initialDialogState: DialogState = {
  createRootOpen: false,
  parentLocation: null,
  editingLocation: null,
  deletingLocation: null,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "open-create-root":
      return { ...state, createRootOpen: true, parentLocation: null };
    case "open-create-child":
      return { ...state, createRootOpen: false, parentLocation: action.location };
    case "open-edit":
      return { ...state, editingLocation: action.location };
    case "open-delete":
      return { ...state, deletingLocation: action.location };
    case "close-create":
      return { ...state, createRootOpen: false, parentLocation: null };
    case "close-edit":
      return { ...state, editingLocation: null };
    case "close-delete":
      return { ...state, deletingLocation: null };
  }
}

export function LocationListPageView({ locations }: LocationListPageViewProps) {
  const expandableIds = useMemo(() => collectExpandableIds(locations), [locations]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(expandableIds));
  const [dialogState, dispatchDialog] = useReducer(dialogReducer, initialDialogState);

  return (
    <main className="px-6 py-6 md:px-16 md:py-8">
      <div className="mx-auto max-w-[876px] space-y-4">
        <h1 className="sr-only">場所一覧</h1>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-[52px] rounded-[10px] bg-black px-4 text-sm font-normal text-white hover:bg-zinc-800"
            onClick={() => dispatchDialog({ type: "open-create-root" })}
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
          onCreateChild={(location) => dispatchDialog({ type: "open-create-child", location })}
          onEdit={(location) => dispatchDialog({ type: "open-edit", location })}
          onDelete={(location) => dispatchDialog({ type: "open-delete", location })}
        />
      </div>

      <LocationFormDialog
        key={dialogState.parentLocation?.locationId ?? "location-create-root"}
        mode="create"
        open={dialogState.createRootOpen || dialogState.parentLocation !== null}
        parentLocation={dialogState.parentLocation}
        onOpenChange={(open) => {
          if (!open) {
            dispatchDialog({ type: "close-create" });
          }
        }}
      />

      <LocationFormDialog
        key={dialogState.editingLocation?.locationId ?? "location-edit-empty"}
        mode="edit"
        open={dialogState.editingLocation !== null}
        location={dialogState.editingLocation}
        onOpenChange={(open) => {
          if (!open) {
            dispatchDialog({ type: "close-edit" });
          }
        }}
      />

      <LocationDeleteDialog
        key={dialogState.deletingLocation?.locationId ?? "location-delete-empty"}
        open={dialogState.deletingLocation !== null}
        location={dialogState.deletingLocation}
        onOpenChange={(open) => {
          if (!open) {
            dispatchDialog({ type: "close-delete" });
          }
        }}
      />
    </main>
  );
}
