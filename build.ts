import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";

type Entry = Readonly<{
  kind: "README";
  name: string;
  path: string;
}>;
const entries: Entry[] = [];

const buildDirectoryPath = join(__dirname, "./build");

mkdirSync(buildDirectoryPath, { recursive: true });

const handleDirectory = (rootDirectory: string) => {
  const directories = readdirSync(rootDirectory);

  for (const directory of directories) {
    const configPath = join(rootDirectory, directory, "config.json");
    const readmePath = join(rootDirectory, directory, "README.md");

    if (!existsSync(readmePath)) {
      continue;
    }

    const config = readFileSync(configPath, "utf8");
    const readme = readFileSync(readmePath, "utf8");

    const jsonConfig = JSON.parse(config);

    const hashDigest = createHash("ripemd160")
      .update("README.md")
      .update(jsonConfig.name)
      .digest("base64url");

    const newReadmePath = join(buildDirectoryPath, `${hashDigest}.md`);

    entries.push({
      kind: "README",
      name: jsonConfig.name,
      path: `${hashDigest}.md`,
    });

    writeFileSync(newReadmePath, readme);
  }
};

handleDirectory(join(__dirname, "./codemods/jscodeshift/next/13"));
handleDirectory(join(__dirname, "./codemods/repomod-engine/next/13"));
handleDirectory(join(__dirname, "./codemods/ts-morph/next/13"));

writeFileSync(join(buildDirectoryPath, "index.json"), JSON.stringify(entries));
