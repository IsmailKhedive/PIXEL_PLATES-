import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
const ignoredDirectories = new Set([
  "node_modules",
  "backend",
  ".git",
  "Pixel-Plates-GitHub",
]);
function findJavaScriptFiles(directory) {
  return readdirSync(directory, {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findJavaScriptFiles(fullPath);
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      return [fullPath];
    }
    return [];
  });
}
const files = findJavaScriptFiles(process.cwd());
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
console.log(`Syntax OK: ${files.length} JavaScript files`);
