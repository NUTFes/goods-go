import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { isTaskStatus } from "@/features/tasks/model/task-status";
import type { UserTaskQueryState } from "./types";

export const userTaskQueryStatesParsers = {
  day: parseAsStringLiteral(["0", "1", "2"] as const).withDefault("0"),
  statuses: parseAsArrayOf(parseAsInteger).withDefault([]),
  fromLocationId: parseAsString.withDefault(""),
  toLocationId: parseAsString.withDefault(""),
  itemIds: parseAsArrayOf(parseAsString).withDefault([]),
};

const searchParamsCache = createSearchParamsCache(userTaskQueryStatesParsers);

export function parseUserTaskQueryState(
  searchParams: Record<string, string | string[] | undefined>,
): UserTaskQueryState {
  const parsed = searchParamsCache.parse(searchParams);
  const statuses = parsed.statuses.filter(isTaskStatus);

  return {
    filters: {
      day: parsed.day,
      statuses,
      fromLocationId: parsed.fromLocationId,
      toLocationId: parsed.toLocationId,
      itemIds: parsed.itemIds.filter((itemId) => itemId.length > 0),
    },
  };
}
