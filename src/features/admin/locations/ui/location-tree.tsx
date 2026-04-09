"use client";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AdminLocation } from "../model/types";

type LocationTreeProps = {
  locations: AdminLocation[];
  expandedIds: Set<string>;
  onExpandedChange: (locationId: string, open: boolean) => void;
  onCreateChild: (location: AdminLocation) => void;
  onEdit: (location: AdminLocation) => void;
  onDelete: (location: AdminLocation) => void;
};

type LocationTreeNodeProps = Omit<LocationTreeProps, "locations"> & {
  location: AdminLocation;
  isNested?: boolean;
};

function canCreateChild(location: AdminLocation) {
  return location.depth < 2;
}

function rowBackgroundClass(hasChildren: boolean, isExpanded: boolean) {
  if (hasChildren && isExpanded) {
    return "bg-[#f3f4f6]";
  }

  return "bg-transparent";
}

function rowBackgroundClass(location: AdminLocation, hasChildren: boolean) {
  return "bg-white";
}

function LocationTreeNode({
  location,
  expandedIds,
  onExpandedChange,
  onCreateChild,
  onEdit,
  onDelete,
  isNested = false,
}: LocationTreeNodeProps) {
  const hasChildren = location.children.length > 0;
  const isExpanded = hasChildren ? expandedIds.has(location.locationId) : false;

  return (
    <div className={cn("relative", isNested && "pl-8")}>
      <Collapsible
        open={isExpanded}
        onOpenChange={(open) => onExpandedChange(location.locationId, open)}
      >
        <div
          className={cn(
            "flex min-h-14 items-center justify-between border-b px-4 py-1",
            location.depth === 0 ? "border-black" : "border-zinc-300",
            rowBackgroundClass(hasChildren, isExpanded),
          )}
        >
          <div className="min-w-0 flex-1">
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-3 text-left text-[18px] font-normal text-[#0a0a0a] outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{location.name}</span>
                </button>
              </CollapsibleTrigger>
            ) : (
              <div className="flex min-h-11 items-center gap-3 pl-7 text-[18px] font-normal text-[#0a0a0a]">
                <span className="truncate">{location.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center">
            {canCreateChild(location) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-11 w-11 rounded-md text-black hover:bg-zinc-200"
                aria-label={`${location.name}の配下に場所を追加`}
                onClick={() => onCreateChild(location)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-11" aria-hidden="true" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-11 w-11 rounded-md hover:bg-zinc-200"
              aria-label={`${location.name}を編集`}
              onClick={() => onEdit(location)}
            >
              <Pencil className="h-5 w-5 text-[#70b64d]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-11 w-11 rounded-md hover:bg-zinc-200"
              aria-label={`${location.name}を削除`}
              onClick={() => onDelete(location)}
            >
              <Trash2 className="h-5 w-5 text-[#ff1f1f]" />
            </Button>
          </div>
        </div>

        {hasChildren ? (
          <CollapsibleContent>
            <div className="ml-6 border-l border-zinc-300">
              {location.children.map((child) => (
                <LocationTreeNode
                  key={child.locationId}
                  location={child}
                  expandedIds={expandedIds}
                  onExpandedChange={onExpandedChange}
                  onCreateChild={onCreateChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isNested
                />
              ))}
            </div>
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </div>
  );
}

export function LocationTree({
  locations,
  expandedIds,
  onExpandedChange,
  onCreateChild,
  onEdit,
  onDelete,
}: LocationTreeProps) {
  return (
    <div className="space-y-0">
      {locations.map((location) => (
        <LocationTreeNode
          key={location.locationId}
          location={location}
          expandedIds={expandedIds}
          onExpandedChange={onExpandedChange}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
