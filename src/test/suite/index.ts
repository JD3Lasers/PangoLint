import * as fs from "node:fs";
import * as path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 10000 });
  const testsRoot = __dirname;
  for (const f of fs.readdirSync(testsRoot)) {
    if (f.endsWith(".test.js")) {
      mocha.addFile(path.resolve(testsRoot, f));
    }
  }
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} Extension Host test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
