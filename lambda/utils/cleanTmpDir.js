import { readdir, rm } from "fs/promises";
import { join } from "path";

const TMP_DIR = "/tmp";

/** Remove all entries under /tmp so warm containers don't accumulate disk usage. */
export default async function cleanTmpDir() {
  let entries;
  try {
    entries = await readdir(TMP_DIR);
  } catch {
    return;
  }

  await Promise.all(
    entries.map((name) =>
      rm(join(TMP_DIR, name), { recursive: true, force: true }).catch(() => {}),
    ),
  );
}
