import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { test } from "bun:test";
import { join } from "node:path";

test("IDP Error Handling", async () => {
  const testDir = join(import.meta.dir);
  console.debug({ testDir });
  const { runConfiguration, useConfiguration } = await loadConfiguration({
    provided: {
      parallel: 1,
      paths: [join(testDir, "integration.feature")],
      require: [
        join(process.cwd(), "tests/step_definitions/docker_compose.ts"),
      ],
      worldParameters: { testDir },
    },
  });

  console.debug({ runConfiguration });
  const { success, support } = await runCucumber(runConfiguration);

  if (!success) {
    throw new Error("❌");
  }
}, 120_000);
