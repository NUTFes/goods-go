import type { AuthRepository } from "../../../repository/authRepository";
import type { LoginInput } from "./loginSchema";

export type LoginResult = { kind: "signed_in" };

export async function loginHandler(
  repo: AuthRepository,
  input: LoginInput,
): Promise<LoginResult> {
  await repo.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  return { kind: "signed_in" };
}
