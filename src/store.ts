import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import type { LinkStore, SavedLink } from "./types";

const EMPTY_STORE: LinkStore = { links: [] };

export function defaultStorePath(): string {
  if (process.env.LINK_SAVER_FILE) {
    return resolve(process.env.LINK_SAVER_FILE);
  }
  return resolve(homedir(), ".link-saver.json");
}

export function loadStore(filePath: string): { store: LinkStore; changed: boolean } {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LinkStore>;
    if (!parsed || !Array.isArray(parsed.links)) {
      throw new Error(`Invalid store file: ${filePath}`);
    }
    const { links, changed } = ensureIds(parsed.links);
    return { store: { links }, changed };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { store: { ...EMPTY_STORE, links: [] }, changed: false };
    }
    throw error;
  }
}

export function ensureIds(links: SavedLink[]): { links: SavedLink[]; changed: boolean } {
  let changed = false;
  const normalized = links.map((link) => {
    if (typeof link.id === "string" && link.id.length > 0) {
      return link;
    }
    changed = true;
    return { ...link, id: crypto.randomUUID() };
  });
  return { links: normalized, changed };
}

export function newestFirst(links: SavedLink[]): SavedLink[] {
  return [...links].sort((a, b) => savedAtMs(b) - savedAtMs(a));
}

function savedAtMs(link: SavedLink): number {
  const value = Date.parse(link.savedAt);
  return Number.isNaN(value) ? 0 : value;
}

export function saveStore(filePath: string, store: LinkStore): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function addLink(
  store: LinkStore,
  link: Omit<SavedLink, "id" | "savedAt">
): SavedLink {
  const existing = store.links.find((item) => item.url === link.url);
  if (existing) {
    const mergedTags = uniqueTags([...existing.tags, ...link.tags]);
    existing.tags = mergedTags;
    if (link.title) {
      existing.title = link.title;
    }
    return existing;
  }

  const saved: SavedLink = {
    id: crypto.randomUUID(),
    url: link.url,
    tags: uniqueTags(link.tags),
    title: link.title,
    savedAt: new Date().toISOString(),
  };
  store.links.unshift(saved);
  return saved;
}

export function searchByTag(store: LinkStore, tag: string): SavedLink[] {
  const needle = tag.trim().toLowerCase();
  return store.links.filter((link) =>
    link.tags.some((item) => item.toLowerCase() === needle)
  );
}

export function findById(links: SavedLink[], id: string): SavedLink | "ambiguous" | undefined {
  const needle = id.trim();
  if (!needle) {
    return undefined;
  }
  const exact = links.find((link) => link.id === needle);
  if (exact) {
    return exact;
  }
  const prefixMatches = links.filter((link) => link.id.startsWith(needle));
  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }
  if (prefixMatches.length > 1) {
    return "ambiguous";
  }
  return undefined;
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
