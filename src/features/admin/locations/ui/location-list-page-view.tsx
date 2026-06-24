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
    <main className="min-h-[calc(100vh-60px)] bg-[#f3f4f6] px-6 py-8 md:px-16">
      <div className="mx-auto flex max-w-[876px] flex-col gap-4">
        <h1 className="sr-only">場所一覧</h1>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-[52px] rounded-md bg-[#171717] px-3 py-4 text-sm font-normal text-[#fafafa] shadow-[0_1px_1px_rgba(0,0,0,0.1)] hover:bg-[#171717]/90"
            onClick={() => dispatchDialog({ type: "open-create-root" })}
          >
            <CirclePlus className="size-5" />
            エリアを追加
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[10px] border-[#e5e7eb] bg-white px-3 text-xs font-normal text-black shadow-[0_1px_1px_rgba(0,0,0,0.25)] hover:bg-white/90"
            onClick={() => setExpandedIds(new Set(expandableIds))}
          >
            <UnfoldVertical className="size-3" />
            全て展開
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[10px] border-[#e5e7eb] bg-white px-3 text-xs font-normal text-black shadow-[0_1px_1px_rgba(0,0,0,0.25)] hover:bg-white/90"
            onClick={() => setExpandedIds(new Set())}
          >
            <FoldVertical className="size-3" />
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
