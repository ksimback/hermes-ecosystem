import fs from "fs";
import path from "path";

let checkpointSequence = 0;

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function writeJsonCheckpoint(filePath, value) {
  const directory = path.dirname(filePath);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${checkpointSequence++}.tmp`,
  );
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(temporary, content, "utf8");
  try {
    let renameError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        fs.renameSync(temporary, filePath);
        return;
      } catch (error) {
        renameError = error;
        if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt === 5) break;
        wait(20 * (attempt + 1));
      }
    }
    // Windows can briefly hold an existing target open (for example via
    // Defender indexing). Preserve the checkpoint with a replacement copy
    // after bounded rename retries; the tmp file is still cleaned below.
    if (renameError && ["EPERM", "EACCES", "EBUSY"].includes(renameError.code)) {
      fs.copyFileSync(temporary, filePath);
      return;
    }
    throw renameError;
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}
