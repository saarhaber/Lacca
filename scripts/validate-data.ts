import { validateAllDataFiles } from "../src/pipeline/validateData.js";

const result = validateAllDataFiles();
if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
console.log("OK: all data files validate against JSON Schema.");
