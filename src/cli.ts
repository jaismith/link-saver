import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  addLink,
  defaultStorePath,
  findById,
  loadStore,
  newestFirst,
  saveStore,
  searchByTag,
} from "./store";
import type { SavedLink } from "./types";

type Command =
  | { name: "save"; url: string; tags: string[]; title?: string; file?: string }
  | { name: "list"; file?: string }
  | { name: "search"; tag: string; file?: string }
  | { name: "export"; out: string; file?: string }
  | { name: "open"; id: string; file?: string }
  | { name: "help" };

export function parseArgs(argv: string[]): Command {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { name: "help" };
  }

  if (command === "save") {
    const flags = parseFlags(rest);
    const url = flags.positional[0];
    if (!url) {
      throw usageError("save requires a URL.\n  link-saver save <url> [--tag name]...");
    }
    return {
      name: "save",
      url,
      tags: flags.tags,
      title: flags.title,
      file: flags.file,
    };
  }

  if (command === "list") {
    const flags = parseFlags(rest);
    return { name: "list", file: flags.file };
  }

  if (command === "search") {
    const flags = parseFlags(rest);
    const tag = flags.positional[0];
    if (!tag) {
      throw usageError("search requires a tag.\n  link-saver search <tag>");
    }
    return { name: "search", tag, file: flags.file };
  }

  if (command === "export") {
    const flags = parseFlags(rest);
    return {
      name: "export",
      out: flags.out ?? flags.positional[0] ?? "links.json",
      file: flags.file,
    };
  }

  if (command === "open") {
    const flags = parseFlags(rest);
    const id = flags.positional[0];
    if (!id) {
      throw usageError("open requires a link id.\n  link-saver open <id>");
    }
    return { name: "open", id, file: flags.file };
  }

  throw usageError(`Unknown command: ${command}`);
}

export function run(argv: string[]): string {
  const command = parseArgs(argv);

  if (command.name === "help") {
    return helpText();
  }

  const filePath = command.file ?? defaultStorePath();
  const loaded = loadStore(filePath);
  const store = loaded.store;
  if (loaded.changed) {
    saveStore(filePath, store);
  }

  if (command.name === "save") {
    const url = normalizeUrl(command.url);
    const saved = addLink(store, {
      url,
      tags: command.tags,
      title: command.title,
    });
    saveStore(filePath, store);
    return `Saved ${formatLink(saved)}\nStored in ${filePath}`;
  }

  if (command.name === "list") {
    if (store.links.length === 0) {
      return `No links saved yet.\nStore: ${filePath}`;
    }
    return renderList(newestFirst(store.links), `Saved links (${store.links.length})`);
  }

  if (command.name === "export") {
    const outPath = resolve(command.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      `${JSON.stringify(newestFirst(store.links), null, 2)}\n`,
      "utf8"
    );
    return `Exported ${store.links.length} link(s) to ${outPath}`;
  }

  if (command.name === "open") {
    const link = findById(store.links, command.id);
    if (link === "ambiguous") {
      throw usageError(`Ambiguous id "${command.id}". Use more of the id.`);
    }
    if (!link) {
      throw usageError(`No saved link with id ${command.id}.`);
    }
    openInBrowser(link.url);
    return `Opened ${formatLink(link)}`;
  }

  const matches = searchByTag(store, command.tag);
  if (matches.length === 0) {
    return `No links tagged "${command.tag}".`;
  }
  return renderList(newestFirst(matches), `Links tagged "${command.tag}" (${matches.length})`);
}

function parseFlags(args: string[]): {
  positional: string[];
  tags: string[];
  title?: string;
  file?: string;
  out?: string;
} {
  const positional: string[] = [];
  const tags: string[] = [];
  let title: string | undefined;
  let file: string | undefined;
  let out: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--tag" || arg === "-t") {
      const value = args[i + 1];
      if (!value) {
        throw usageError(`${arg} requires a value.`);
      }
      tags.push(value);
      i += 1;
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tags.push(arg.slice("--tag=".length));
      continue;
    }
    if (arg === "--tags") {
      const value = args[i + 1];
      if (!value) {
        throw usageError("--tags requires a comma-separated list.");
      }
      tags.push(...value.split(","));
      i += 1;
      continue;
    }
    if (arg === "--title") {
      const value = args[i + 1];
      if (!value) {
        throw usageError("--title requires a value.");
      }
      title = value;
      i += 1;
      continue;
    }
    if (arg === "--file" || arg === "-f") {
      const value = args[i + 1];
      if (!value) {
        throw usageError(`${arg} requires a path.`);
      }
      file = value;
      i += 1;
      continue;
    }
    if (arg === "--out" || arg === "-o") {
      const value = args[i + 1];
      if (!value) {
        throw usageError(`${arg} requires a path.`);
      }
      out = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw usageError(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  return { positional, tags, title, file, out };
}

function normalizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("only http and https URLs are supported");
    }
    return parsed.toString();
  } catch {
    throw usageError(`Not a valid URL: ${raw}`);
  }
}

function renderList(links: SavedLink[], heading: string): string {
  const lines = [heading, ""];
  for (const link of links) {
    lines.push(formatLink(link));
  }
  return lines.join("\n");
}

function formatLink(link: SavedLink): string {
  const tags = link.tags.length > 0 ? link.tags.join(", ") : "(no tags)";
  const title = link.title ? `${link.title} — ` : "";
  return `${link.id}  ${title}${link.url}  [${tags}]`;
}

export function helpText(): string {
  return `link-saver — save URLs with tags

Usage:
  link-saver save <url> [--tag name]... [--title text]
  link-saver list
  link-saver search <tag>
  link-saver export [path]
  link-saver open <id>

Options:
  --tag, -t      Tag to attach (repeatable)
  --tags         Comma-separated tags
  --title        Optional title
  --file, -f     JSON store path (default: ~/.link-saver.json)
  --out, -o      JSON output path for export (default: links.json)
  --help, -h     Show this help

Examples:
  link-saver save https://example.com --tag docs --tag reference
  link-saver list
  link-saver search docs
  link-saver export links.json
  link-saver open <id>
`;
}

function openInBrowser(url: string): void {
  const override = process.env.LINK_SAVER_BROWSER;
  let command: string;
  let args: string[];
  if (override) {
    command = override;
    args = [url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const result = spawnSync(command, args, { stdio: "ignore" });
  if (result.error) {
    throw new Error(`Could not open the default browser: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Could not open ${url} in the default browser.`);
  }
}

function usageError(message: string): Error {
  const error = new Error(message);
  error.name = "UsageError";
  return error;
}
