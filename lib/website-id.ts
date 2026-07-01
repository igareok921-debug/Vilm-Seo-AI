import type { Website } from "@/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined) {
  return Boolean(value && uuidPattern.test(value));
}

function normalizeIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function websiteAliases(website: Pick<Website, "id" | "name" | "url">) {
  const domain = normalizeIdentifier(website.url);
  const rootDomain = domain.split("/")[0];
  const domainWithoutTld = rootDomain.split(".")[0];
  const nameSlug = website.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  return new Set([
    normalizeIdentifier(website.id),
    domain,
    rootDomain,
    domainWithoutTld,
    nameSlug,
  ]);
}

export function resolveWebsiteIdentifier(
  identifier: string | null | undefined,
  websites: Pick<Website, "id" | "name" | "url">[],
) {
  if (!identifier) return null;

  const normalized = normalizeIdentifier(identifier);
  const exact = websites.find((website) => website.id === identifier);
  if (exact) return exact;

  return websites.find((website) => websiteAliases(website).has(normalized)) ?? null;
}
