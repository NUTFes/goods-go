import { getAdminLocationListPageData } from "@/features/admin/locations/server/queries";
import { LocationListPageView } from "@/features/admin/locations/ui/location-list-page-view";

export default async function AdminLocationsPage() {
  const { locations } = await getAdminLocationListPageData();

  return <LocationListPageView locations={locations} />;
}
