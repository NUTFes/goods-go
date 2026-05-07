export type HierarchicalLocationRow = {
  location_id: string;
  name: string;
  parent_location_id: string | null;
};

export type LocationFilterOption = {
  value: string;
  label: string;
  group: string;
};

export function toLeafLocationFilterOptions(
  rows: HierarchicalLocationRow[],
): LocationFilterOption[] {
  const childParentIds = new Set(
    rows
      .map((row) => row.parent_location_id)
      .filter((parentId): parentId is string => parentId !== null),
  );
  const locationById = new Map(rows.map((row) => [row.location_id, row]));

  function findRootGroup(row: HierarchicalLocationRow): string {
    let current = row;
    const visited = new Set<string>();

    while (current.parent_location_id && !visited.has(current.location_id)) {
      visited.add(current.location_id);
      const parent = locationById.get(current.parent_location_id);
      if (!parent) {
        break;
      }
      current = parent;
    }

    return current.name;
  }

  return rows
    .filter((row) => !childParentIds.has(row.location_id))
    .map((row) => ({
      value: row.location_id,
      label: row.name,
      group: row.parent_location_id ? findRootGroup(row) : "",
    }))
    .sort((left, right) => {
      const groupResult = left.group.localeCompare(right.group, "ja");
      if (groupResult !== 0) {
        return groupResult;
      }
      return left.label.localeCompare(right.label, "ja");
    });
}
