export type EventDayType = 0 | 1 | 2;
export type TaskStatus = 0 | 1 | 2;

export type TaskFilterState = {
  day: "all" | "0" | "1" | "2";
  status: "all" | "0" | "1" | "2";
  itemId: string;
  leaderUserId: string;
  fromLocationId: string;
  toLocationId: string;
};

export type TaskSortKey = "status" | "itemAndQuantity" | "scheduledStartTime";

export type TaskSortState = {
  key: TaskSortKey;
  direction: "asc" | "desc";
};

export type TaskListQueryState = {
  filters: TaskFilterState;
  sort: TaskSortState;
};

export type TaskFormOption = {
  value: string;
  label: string;
  group: string;
};

export type TaskFilterOptions = {
  items: TaskFormOption[];
  leaders: TaskFormOption[];
  locations: TaskFormOption[];
  timeOptions: string[];
};

export type AdminTask = {
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
  actualStartTime: string | null;
  actualEndTime: string | null;
  leaderUserId: string | null;
  leaderName: string | null;
  note: string | null;
};

export type AdminTaskListPageData = {
  tasks: AdminTask[];
  filterOptions: TaskFilterOptions;
};

export type ActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };
