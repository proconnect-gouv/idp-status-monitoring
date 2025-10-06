import { After, Given, Then, When, World } from "@cucumber/cucumber";
import { expect } from "bun:test";
import { basename, join } from "node:path";

// Helper to run docker compose commands
async function runCompose(
  projectName: string,
  args: string,
  cwd: string,
  options: { capture?: boolean } = {},
): Promise<string> {
  const proc = Bun.spawn(
    [
      "docker",
      "compose",
      "--file",
      "compose.yaml",
      "--project-name",
      projectName,
      ...args.split(" "),
    ],
    {
      cwd,
      stdout: options.capture ? "pipe" : "inherit",
      stderr: options.capture ? "pipe" : "inherit",
    },
  );

  if (options.capture) {
    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      console.error(error);
      throw new Error(
        `docker compose ${args} failed with exit code ${proc.exitCode}`,
      );
    }

    return output;
  }

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error(
      `docker compose ${args} failed with exit code ${proc.exitCode}`,
    );
  }

  return "";
}

export interface DockerComposeWorld extends World {
  currentDir: string;
  projectName: string;
}

// Background steps
Given("I am in this directory", function (this: DockerComposeWorld) {
  // Get directory from world parameters passed by test file
  const testDir = this.parameters?.testDir || process.cwd();

  this.currentDir = testDir;
  this.projectName = basename(this.currentDir);
});

// Legacy support for explicit directory
Given(
  "I am in the {string} directory",
  function (this: DockerComposeWorld, dir: string) {
    this.currentDir = join(process.cwd(), dir);
    this.projectName = basename(this.currentDir);
  },
);

// Command execution steps
When(
  "I run compose {string}",
  { timeout: 60000 },
  async function (this: DockerComposeWorld, args: string) {
    await runCompose(this.projectName, args, this.currentDir);
  },
);

// Assertion steps
Then(
  "I run compose {string} and the service should be {string}",
  async function (
    this: DockerComposeWorld,
    args: string,
    expectedState: string,
  ) {
    const output = await runCompose(this.projectName, args, this.currentDir, {
      capture: true,
    });

    const services = JSON.parse(`[${output.trim().replace(/}\n{/g, "},{")}]`);

    if (expectedState === "healthy") {
      expect(services[0].Health).toBe("healthy");
    } else if (expectedState === "running") {
      expect(services[0].State).toBe("running");
    }
  },
);

Then(
  "I run compose {string} and it should contain {string}",
  async function (
    this: DockerComposeWorld,
    args: string,
    expectedText: string,
  ) {
    const output = await runCompose(this.projectName, args, this.currentDir, {
      capture: true,
    });

    expect(output).toContain(expectedText);
  },
);

Then(
  "I run compose {string} and it should not contain {string}",
  async function (
    this: DockerComposeWorld,
    args: string,
    expectedText: string,
  ) {
    const output = await runCompose(this.projectName, args, this.currentDir, {
      capture: true,
    });

    expect(output).not.toContain(expectedText);
  },
);

// Cleanup
After({ timeout: 30000 }, async function (this: DockerComposeWorld) {
  await runCompose(this.projectName, "down --volumes", this.currentDir);
});
