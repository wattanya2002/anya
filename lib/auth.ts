import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  orgId: string;
  orgName: string;
  orgIsDemo: boolean;
  role: string;
  roleNameTh: string;
  permissions: Set<string>;
};

/** Loads the signed-in user from the database on every request (disabled users and
 *  bumped session versions are rejected server-side, not just hidden in the UI). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.userId) return null;
  const { rows } = await db().query(
    `select u.id, u.email, u.display_name, u.must_change_password, u.session_version,
            o.id as org_id, o.name as org_name, o.is_demo, r.key as role, r.name_th as role_name,
            coalesce(array_agg(rp.permission_key) filter (where rp.permission_key is not null), '{}') as perms
       from users u
       join memberships m on m.user_id = u.id
       join organizations o on o.id = m.org_id
       join roles r on r.key = m.role_key
       left join role_permissions rp on rp.role_key = r.key
      where u.id = $1 and u.status = 'active'
      group by u.id, o.id, r.key
      order by o.created_at
      limit 1`,
    [session.userId],
  );
  const row = rows[0];
  if (!row || row.session_version !== session.sessionVersion) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    mustChangePassword: row.must_change_password,
    orgId: row.org_id,
    orgName: row.org_name,
    orgIsDemo: row.is_demo,
    role: row.role,
    roleNameTh: row.role_name,
    permissions: new Set(row.perms as string[]),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export function can(user: CurrentUser, permission: string) {
  return user.permissions.has(permission);
}
