import * as fs from "node:fs";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

// VS Code 1.118+ switched win32 archive to APPX format, which @vscode/test-electron
// cannot launch as an Electron app. Use the machine's installed VS Code instead.
function findInstalledVSCode(): string | undefined {
  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code", "Code.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft VS Code", "Code.exe"),
    process.env.VSCODE_EXECUTABLE ?? "",
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const vscodeExecutablePath = findInstalledVSCode();
  await runTests({ extensionDevelopmentPath, extensionTestsPath, vscodeExecutablePath });
}

main().catch((err) => {
  console.error("Extension Host test run failed:", err);
  process.exit(1);
});
