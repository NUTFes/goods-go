import { parseUserTaskQueryState } from "@/features/user/tasks/model/query-state";
import { getUserTaskListPageData } from "@/features/user/tasks/server/queries";
import { TaskListPageView } from "@/features/user/tasks/ui/task-list-page-view";

export const metadata = {
  title: "タスク一覧",
  description: "ユーザー向けタスク一覧ページ",
};

type UserTasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UserTasksPage({ searchParams }: UserTasksPageProps) {
  const queryState = parseUserTaskQueryState(await searchParams);
  const { currentUser, tasks, filterOptions } = await getUserTaskListPageData(queryState);

  return <TaskListPageView currentUser={currentUser} tasks={tasks} filterOptions={filterOptions} />;
}
