import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../../previews/", import.meta.url));

/** Keep local visual QA artifacts outside the tracked source tree. */
export function previewPath(filename: string): string {
  mkdirSync(directory, { recursive: true });
  return join(directory, filename);
}
