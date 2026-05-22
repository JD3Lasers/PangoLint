import {
  liveBeyondSmokeConfigFromEnv,
  parseLiveBeyondSmokeArgs,
  runLiveBeyondSmokeChecks,
  usage,
} from "./liveBeyondSmokeLib";

async function main(): Promise<void> {
  try {
    const args = parseLiveBeyondSmokeArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }

    const config = liveBeyondSmokeConfigFromEnv(process.env, args);
    const result = await runLiveBeyondSmokeChecks(config);
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[live-beyond-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

void main();
