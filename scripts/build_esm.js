import { transformFile } from "@swc/core";
import { join, relative, dirname } from "path";
import { execSync } from "child_process";
import fs from "fs/promises";
import { plugin } from "swc-plugin-purescript-esm";

// get the output path of spago
const inputDir = join(
  process.cwd(),
  execSync("npx spago path output").toString().trim()
);
// set the out dir to normal output dir with suffix
const outDir = inputDir + "_esm";

/**
 * SWC from what I can tell does not have a node
 * api to compile a dir like it's command line counterpart
 * @param {string} inDir
 * @param {string} outDir
 * @returns {Promise<void>}
 */
async function transpileDir(inDir, outDir) {
  const psOutputFiles = await readPursOutputFiles(inDir);
  const thunks = psOutputFiles.map((file) => async () => {
    try {
      const outFile = join(outDir, relative(inDir, file));
      const { code } = await transformFile(file, { plugin: plugin() });
      await fs.mkdir(dirname(outFile), { recursive: true });
      return fs.writeFile(outFile, code);
    } catch (e) {
      console.error(`error transpiling ${file} : ${e}`);
    }
  });
  await Promise.all(thunks.map((thunk) => thunk()));
}

/**
 * Reads the output js files from disk
 *
 * (there are probably better ways to do this)
 *
 * @param {string} inDir
 * @returns {Promise<string[]>}
 */
async function readPursOutputFiles(inDir) {
  const all = await fs.readdir(inDir);
  const files = await Promise.all(
    all.map(async (root) => {
      const fullPath = join(inDir, root);
      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        return [];
      }
      return fs
        .readdir(fullPath)
        .then((files) => files.map((f) => join(fullPath, f)))
        .then((files) => files.filter((file) => file.endsWith(".js")));
    })
  );
  return files.flat();
}

transpileDir(inputDir, outDir);
