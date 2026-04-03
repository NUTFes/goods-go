import { getAdminItemListPageData } from "@/features/admin/items/server/queries";
import { ItemListPageView } from "@/features/admin/items/ui/item-list-page-view";

export default async function AdminGoodsPage() {
  const { items } = await getAdminItemListPageData();

  return <ItemListPageView items={items} />;
}
