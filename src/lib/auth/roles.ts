import type { Tables } from "@/types/schema.gen";

export const APP_ROLES = {
  ADMIN: 0,
  LEADER: 1,
  USER: 2,
} as const;

export const APP_ROLE_VALUES = [
  APP_ROLES.ADMIN,
  APP_ROLES.LEADER,
  APP_ROLES.USER,
] as const;

export type AppRole = Tables<"users">["role"] & (typeof APP_ROLE_VALUES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "number" &&
    APP_ROLE_VALUES.some((roleValue) => roleValue === value)
  );
}