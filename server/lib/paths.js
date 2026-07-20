import path from "node:path";
import { fileURLToPath } from "node:url";

// import.meta.url is empty when this module runs inside the esbuild CJS
// bundle used for the standalone executable — guard against that instead
// of letting fileURLToPath throw, since ABOWANDLER_BUNDLED_DATA_DIR covers
// that case below.
const __dirname = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : null;

// Mutable app data (db.json, encryption key, API key config) lives here.
// Defaults to server/data for plain `node index.js` dev use; the Electron
// shell and the standalone executable override this to point at the OS's
// per-user home folder, so nothing is ever written next to the app's own
// program files.
export const DATA_DIR = process.env.ABOWANDLER_DATA_DIR || path.join(__dirname, "..", "data");

// Read-only files shipped with the app (seed data, ETF reference data).
// Normally sit next to the source; the standalone executable ships them
// in a "data" folder next to the compiled binary instead and points here
// via ABOWANDLER_BUNDLED_DATA_DIR (see server/standalone.js).
export const BUNDLED_DATA_DIR = process.env.ABOWANDLER_BUNDLED_DATA_DIR || path.join(__dirname, "..", "data");
