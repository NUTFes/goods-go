import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import type { TaskStatus, UserTaskQueryState } from "./types";

export const userTaskQueryStatesParsers = {
  day: parseAsStringLiteral(["0", "1", "2"] as const).withDefault("0"),
  statuses: parseAsArrayOf(parseAsInteger).withDefault([]),
  fromLocationId: parseAsString.withDefault(""),
  toLocationId: parseAsString.withDefault(""),
  itemIds: parseAsArrayOf(parseAsString).withDefault([]),
};

const searchParamsCache = createSearchParamsCache(userTaskQueryStatesParsers);

function isTaskStatus(value: number): value is TaskStatus {
  return value === 0 || value === 1 || value === 2;
}

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
