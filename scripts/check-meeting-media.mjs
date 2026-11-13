import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const meetingFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? meetingFiles(fullPath)
      : entry.name.endsWith(".mdx") && entry.name !== "index.mdx"
        ? [fullPath]
        : [];
  });

const componentNames = ["DriveVideo", "AudioPlayer", "YouTubeVideo"];
const counts = Object.fromEntries(componentNames.map((name) => [name, 0]));
const files = meetingFiles("meetings");

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const used = componentNames.filter((name) =>
    new RegExp(`<${name}\\b`).test(source),
  );
  const importLine = source.match(
    /^import \{ ([^}]+) \} from "\/snippets\/meeting-media\.jsx";$/gm,
  );

  if (used.length) {
    assert.equal(importLine?.length, 1, `${file}: expected one media snippet import`);
    const imported = importLine[0].match(/\{ ([^}]+) \}/)[1].split(", ");
    assert.deepEqual(imported, used, `${file}: media imports must match usage`);
  } else {
    assert.equal(importLine, null, `${file}: unused media snippet import`);
  }

  assert.doesNotMatch(
    source,
    /<iframe\b[\s\S]*?src="https:\/\/(?:drive\.google\.com|www\.youtube-nocookie\.com)\//,
    `${file}: legacy video iframe remains`,
  );
  assert.doesNotMatch(
    source,
    /<video\b[\s\S]*?src="[^"]+\.mp3"/,
    `${file}: an audio recording is still rendered as video`,
  );
  for (const name of used) {
    counts[name] += [...source.matchAll(new RegExp(`<${name}\\b`, "g"))].length;
  }
}

for (const [name, count] of Object.entries(counts)) {
  assert.ok(count > 0, `No ${name} component found in meeting archive`);
}
console.log(`Checked ${files.length} meeting files: ${JSON.stringify(counts)}`);
