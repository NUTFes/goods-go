export type AdminItem = {
  itemId: string;
  name: string;
};

export type AdminItemListPageData = {
  items: AdminItem[];
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
