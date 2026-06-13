"use client";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
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
};

type LocationTreeLineStyle = CSSProperties & {
  "--location-tree-line-left": string;
};

function canCreateChild(location: AdminLocation) {
  return location.depth < 2;
}

function LocationTreeNode({
  location,
  expandedIds,
  onExpandedChange,
  onCreateChild,
  onEdit,
  onDelete,
}: LocationTreeNodeProps) {
  const hasChildren = location.children.length > 0;
  const isExpanded = hasChildren ? expandedIds.has(location.locationId) : false;
  const indent = location.depth * 56;

  return (
    <div className="relative">
      <Collapsible
        open={isExpanded}
        onOpenChange={(open) => onExpandedChange(location.locationId, open)}
      >
        <div
          className="flex min-h-14 items-center justify-between rounded-lg border-b border-[#e5e5e5] bg-white px-4 py-1 transition-colors duration-200 ease-out motion-reduce:transition-none"
          style={{ marginLeft: indent }}
        >
          <div className="min-w-0 flex-1">
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex min-h-11 items-center gap-2 text-left text-[20px] leading-5 font-normal text-[#0a0a0a] outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                  </span>
                  <span className="truncate">{location.name}</span>
                </button>
              </CollapsibleTrigger>
            ) : (
              <div className="flex min-h-11 items-center text-[20px] leading-5 font-normal text-[#0a0a0a]">
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
                className="size-12 rounded-md text-black transition-colors duration-200 hover:bg-black/5"
                aria-label={`${location.name}の配下に場所を追加`}
                onClick={() => onCreateChild(location)}
              >
                <Plus className="size-5" />
              </Button>
            ) : (
              <div className="w-12" aria-hidden="true" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-12 rounded-md transition-colors duration-200 hover:bg-black/5"
              aria-label={`${location.name}を編集`}
              onClick={() => onEdit(location)}
            >
              <Pencil className="size-5 text-[#70b64d]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-12 rounded-md transition-colors duration-200 hover:bg-black/5"
              aria-label={`${location.name}を削除`}
              onClick={() => onDelete(location)}
            >
              <Trash2 className="size-5 text-[#ff1f1f]" />
            </Button>
          </div>
        </div>

        {hasChildren ? (
          <CollapsibleContent
            className={cn(
              "overflow-hidden",
              "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1",
            )}
          >
            <div
              className={cn(
                "relative",
                isExpanded &&
                  "before:absolute before:top-3 before:bottom-3 before:left-[var(--location-tree-line-left)] before:w-px before:bg-[#d1d5db]",
              )}
              style={{ "--location-tree-line-left": `${indent + 24}px` } as LocationTreeLineStyle}
            >
              {location.children.map((child) => (
                <LocationTreeNode
                  key={child.locationId}
                  location={child}
                  expandedIds={expandedIds}
                  onExpandedChange={onExpandedChange}
                  onCreateChild={onCreateChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
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
    <div>
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
