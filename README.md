# link-saver

A small TypeScript CLI for saving URLs with tags. Links are stored in a local JSON file.

## Setup

```bash
npm install
npm run build
```

For local development without a build step:

```bash
npm install
```

## Usage

Save a URL (tags are optional and repeatable):

```bash
npx tsx src/index.ts save https://example.com --tag docs --tag reference
```

You can also pass several tags at once:

```bash
npx tsx src/index.ts save https://nodejs.org --tags runtime,docs --title "Node.js"
```

List everything:

```bash
npx tsx src/index.ts list
```

Search by tag:

```bash
npx tsx src/index.ts search docs
```

Export every saved link as JSON (newest first). Defaults to `links.json` in the current directory:

```bash
npx tsx src/index.ts export
npx tsx src/index.ts export ./backup.json
```

Open a saved link in the default browser (use the id from `list`; a unique prefix is enough):

```bash
npx tsx src/index.ts list
npx tsx src/index.ts open <id>
```

After `npm run build`, the same commands work as:

```bash
node dist/index.js save https://example.com --tag docs
node dist/index.js list
node dist/index.js search docs
node dist/index.js export links.json
node dist/index.js open <id>
```

## Storage

By default, links are written to `~/.link-saver.json`. Override the path with `--file` or `LINK_SAVER_FILE`:

```bash
npx tsx src/index.ts save https://example.com --tag notes --file ./links.json
LINK_SAVER_FILE=./links.json npx tsx src/index.ts list
```

Saving the same URL again merges tags instead of creating a duplicate. Links that were saved without an id get one the next time the store is read.

## Commands

| Command | What it does |
| --- | --- |
| `save <url>` | Add a URL, optionally with `--tag`, `--tags`, and `--title` |
| `list` | Print every saved link, newest first, with the id at the start of each row |
| `search <tag>` | Print links that have that tag |
| `export [path]` | Write every saved link to JSON (`links.json` if no path is given) |
| `open <id>` | Open that saved link in the default browser |
