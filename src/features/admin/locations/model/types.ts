export type AdminLocation = {
  locationId: string;
  parentLocationId: string | null;
  name: string;
  depth: number;
  children: AdminLocation[];
};

export type AdminLocationListPageData = {
  locations: AdminLocation[];
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
