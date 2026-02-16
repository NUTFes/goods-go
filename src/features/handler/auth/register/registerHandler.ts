import type { AuthRepository } from "../../../repository/authRepository";
import { RegisterInputSchema, type RegisterInput } from "./registerSchema";

export type RegisterResult =
  | { kind: "signed_in" }
  | { kind: "confirm_email_required" };

export async function registerHandler(
  repo: AuthRepository,
  input: unknown,
): Promise<RegisterResult> {
  const v: RegisterInput = RegisterInputSchema.parse(input);

  // AuthRepository 側で error は throw される前提なので、
  // ここでは { user, session } を受け取って判定する。
  const { session } = await repo.signUp({
    email: v.email,
    password: v.password,
    name: v.name,
  });

  // Confirm email がONだと session が null -> メール確認待ち
  if (!session) return { kind: "confirm_email_required" };

  return { kind: "signed_in" };
}
