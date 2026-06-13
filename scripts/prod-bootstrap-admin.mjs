import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const [email, passwordFile] = process.argv.slice(2);
const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!email || !passwordFile || !supabaseUrl || !secretKey) {
  throw new Error("bootstrap admin configuration is incomplete");
}

const password = readFileSync(passwordFile, "utf8").replace(/[\r\n]+$/, "");
if (!/^[A-Za-z0-9]{8,}$/.test(password)) {
  throw new Error("admin password must contain at least 8 ASCII letters or digits");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const normalizedEmail = email.trim().toLowerCase();
const matchingUsers = [];
let page = 1;

while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;

  const users = data.users ?? [];
  matchingUsers.push(
    ...users.filter((user) => user.email?.trim().toLowerCase() === normalizedEmail),
  );
  if (users.length < 1000) break;
  page += 1;
}

if (matchingUsers.length > 1) {
  throw new Error(`multiple Auth users match ${normalizedEmail}`);
}

const attributes = {
  email: normalizedEmail,
  password,
  email_confirm: true,
};

if (matchingUsers.length === 1) {
  const { error } = await supabase.auth.admin.updateUserById(matchingUsers[0].id, attributes);
  if (error) throw error;
  process.stdout.write(`Auth user prepared: ${matchingUsers[0].id}\n`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    ...attributes,
    user_metadata: { name: normalizedEmail.split("@", 1)[0] },
  });
  if (error) throw error;
  process.stdout.write(`Auth user created: ${data.user.id}\n`);
}
