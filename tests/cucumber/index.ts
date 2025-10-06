//

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { join } from "node:path";

//

// const { runConfiguration } = await loadConfiguration({
//   provided: {
//     parallel: 1,
//     paths: [join(process.cwd(), "examples/**/*.feature")],
//     require: [join(process.cwd(), "tests/step_definitions/docker_compose.ts")],
//   },
// });

export async function run(cwd: string) {
  const environment = { cwd };
  const { runConfiguration } = await loadConfiguration(
    {
      provided: {
        require: [
          join(process.cwd(), "tests/step_definitions/docker_compose.ts"),
        ],
        worldParameters: { testDir: cwd },
      },
    },
    { cwd },
  );
  const { success } = await runCucumber(
    {
      ...runConfiguration,

      sources: { ...runConfiguration.sources, paths: [join(cwd, "*.feature")] },
    },
    environment,
  );
  //     await runCucumber(
  //       { ...runConfiguration, support },
  //       environment,
  //       (envelope) => messages.push(envelope)
  //     )
  // const { success } = await runCucumber({
  //   ...runConfiguration,
  //   sources: {
  //     ...runConfiguration.sources,
  //     // paths: [join(cwd, "*.feature")],
  //   },
  //   runtime: {
  //     ...runConfiguration.runtime,

  //     worldParameters: { testDir: cwd },
  //   },
  // });

  if (!success) {
    throw new Error("❌ Some integration tests failed");
  }
}
