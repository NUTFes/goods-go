import type { AppRole } from "@/lib/auth/roles";
import type { Tables } from "@/types/schema.gen";

export type EventDayType = Tables<"tasks">["event_day_type"] & (0 | 1 | 2);
export type TaskStatus = Tables<"tasks">["current_status"] & (0 | 1 | 2);
export const TASK_NOTE_MAX_LENGTH = 1000;

export type UserTaskFilterState = {
  day: "0" | "1" | "2";
  statuses: TaskStatus[];
  fromLocationId: string;
  toLocationId: string;
  itemIds: string[];
};

export type UserTaskQueryState = {
  filters: UserTaskFilterState;
};

export type UserTaskFilterOption = {
  value: string;
  label: string;
  group: string;
};

export type UserTaskFilterOptions = {
  items: UserTaskFilterOption[];
  locations: UserTaskFilterOption[];
};

export type UserTask = {
  taskId: string;
  eventDayType: EventDayType;
  currentStatus: TaskStatus;
  itemId: string;
  itemName: string;
  quantity: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  leaderUserId: string | null;
  leaderName: string | null;
  note: string | null;
};

export type UserTaskCurrentUser = {
  userId: string;
  name: string;
  role: AppRole;
};

export type UserTaskListPageData = {
  currentUser: UserTaskCurrentUser;
  tasks: UserTask[];
  filterOptions: UserTaskFilterOptions;
};

export type ActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };
