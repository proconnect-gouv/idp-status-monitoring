import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { test } from "bun:test";
import { join } from "node:path";

test(
  "Producer-Consumer Integration",
  async () => {
    const testDir = join(import.meta.dir);

    const { runConfiguration } = await loadConfiguration({
      provided: {
        parallel: 1,
        paths: [join(testDir, "integration.feature")],
        require: [join(process.cwd(), "tests/step_definitions/docker_compose.ts")],
        worldParameters: { testDir },
      },
    });

    const { success } = await runCucumber(runConfiguration);

    if (!success) {
      throw new Error("❌");
    }
  },
  { timeout: 120_000 },
);
