import { parseTaskListQueryState } from "@/features/admin/tasks/model/query-state";
import { getAdminTaskListPageData } from "@/features/admin/tasks/server/queries";
import { TaskListPageView } from "@/features/admin/tasks/ui/task-list-page-view";

type AdminTasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTasksPage({ searchParams }: AdminTasksPageProps) {
  const queryState = parseTaskListQueryState(await searchParams);

  const { tasks, filterOptions } = await getAdminTaskListPageData(queryState);

  return <TaskListPageView tasks={tasks} filterOptions={filterOptions} />;
}
