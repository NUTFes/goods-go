import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import type { TaskListQueryState } from "./types";

export const taskListQueryStatesParsers = {
  day: parseAsStringLiteral(["all", "0", "1", "2"] as const).withDefault("all"),
  status: parseAsStringLiteral(["all", "0", "1", "2"] as const).withDefault(
    "all",
  ),
  itemId: parseAsString.withDefault(""),
  leaderUserId: parseAsString.withDefault(""),
  fromLocationId: parseAsString.withDefault(""),
  toLocationId: parseAsString.withDefault(""),
  sortKey: parseAsStringLiteral([
    "status",
    "itemAndQuantity",
    "scheduledStartTime",
  ] as const).withDefault("scheduledStartTime"),
  sortDirection: parseAsStringLiteral(["asc", "desc"] as const).withDefault(
    "asc",
  ),
};

const searchParamsCache = createSearchParamsCache(taskListQueryStatesParsers);

export function parseTaskListQueryState(
  searchParams: Record<string, string | string[] | undefined>,
): TaskListQueryState {
  const parsed = searchParamsCache.parse(searchParams);

  return {
    filters: {
      day: parsed.day,
      status: parsed.status,
      itemId: parsed.itemId,
      leaderUserId: parsed.leaderUserId,
      fromLocationId: parsed.fromLocationId,
      toLocationId: parsed.toLocationId,
    },
    sort: {
      key: parsed.sortKey,
      direction: parsed.sortDirection as "asc" | "desc",
    },
  };
}
