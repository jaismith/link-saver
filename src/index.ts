#!/usr/bin/env node
import { helpText, run } from "./cli";

function main(): void {
  try {
    const output = run(process.argv.slice(2));
    process.stdout.write(`${output}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof Error && error.name === "UsageError") {
      process.stderr.write(`\n${helpText()}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = 1;
  }
}

main();
