//

import { $ } from "bun";
import { test } from "bun:test";

//

test(
  "Producer-Consumer Integration",
  async () =>
    $.cwd(import.meta.dir).env({
      ...process.env,
      FORCE_COLOR: "1",
    })`bun x --bun cucumber-js --import ../../tests/step_definitions/* *.feature`,
  {
    timeout: 120_000,
  },
);
