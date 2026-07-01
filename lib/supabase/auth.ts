import "server-only";

import { cache } from "react";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
}

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface UserWorkspace {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
  organization: UserOrganization;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface OrganizationMemberRow {
  role: string;
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function logAuthSupabaseError(context: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const parts: SupabaseLikeError = {
    message: typeof record.message === "string" ? record.message : error instanceof Error ? error.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };

  console.error(context, {
    message: parts.message ?? "Supabase error without a message.",
    code: parts.code ?? null,
    details: parts.details ?? null,
    hint: parts.hint ?? null,
  });
}

function fallbackName(email: string) {
  return email.split("@")[0] || "Client VILM SEO AI";
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organizatie";
}

export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;

    return {
      id: data.user.id,
      email: data.user.email,
      metadata: data.user.user_metadata,
    };
  } catch {
    return null;
  }
});

export const getCurrentWorkspace = cache(async (): Promise<UserWorkspace | null> => {
  const user = await getCurrentUser();
  if (!user || !isSupabaseAdminConfigured()) return null;

  const admin = createAdminClient();
  const fullName =
    typeof user.metadata?.full_name === "string"
      ? user.metadata.full_name
      : typeof user.metadata?.name === "string"
        ? user.metadata.name
        : fallbackName(user.email);
  const avatarUrl =
    typeof user.metadata?.avatar_url === "string" ? user.metadata.avatar_url : null;

  const profileResult = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  let profile = profileResult.data;

  if (profileResult.error) {
    logAuthSupabaseError("[auth] Profilul nu a putut fi citit:", profileResult.error);
  }

  if (!profile) {
    const { data, error: profileCreateError } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: "client",
      })
      .select("id, email, full_name, avatar_url, role")
      .single<ProfileRow>();
    if (profileCreateError) {
      logAuthSupabaseError("[auth] Profilul nu a putut fi creat:", profileCreateError);
      return null;
    }
    profile = data;
  }

  const membershipResult = await admin
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<OrganizationMemberRow>();
  let membership = membershipResult.data;

  if (membershipResult.error) {
    logAuthSupabaseError("[auth] Membership-ul nu a putut fi citit:", membershipResult.error);
  }

  if (!membership?.organizations) {
    const orgSlug = `${slugify(fullName)}-${user.id.replace(/-/g, "").slice(0, 8)}`;
    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: fullName,
        slug: orgSlug,
        owner_id: user.id,
      })
      .select("id, name, slug")
      .single<{ id: string; name: string; slug: string }>();

    if (orgError || !organization) {
      logAuthSupabaseError("[auth] Organization could not be created:", orgError);
      return null;
    }

    const { error: membershipCreateError } = await admin.from("organization_members").insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "owner",
    });

    if (membershipCreateError) {
      logAuthSupabaseError("[auth] Membership-ul nu a putut fi creat:", membershipCreateError);
      return null;
    }

    membership = {
      role: "owner",
      organizations: organization,
    };
  }

  if (!profile || !membership.organizations) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: {
      id: profile.id,
      email: profile.email ?? user.email,
      fullName: profile.full_name ?? fullName,
      avatarUrl: profile.avatar_url ?? avatarUrl,
      role: profile.role ?? "client",
    },
    organization: {
      id: membership.organizations.id,
      name: membership.organizations.name,
      slug: membership.organizations.slug,
      role: membership.role,
    },
  };
});
