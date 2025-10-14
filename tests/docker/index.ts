import { basename } from "node:path";

export interface DockerComposeOptions {
  capture?: boolean;
}

export interface ServiceStatus {
  Name: string;
  State: string;
  Health?: string;
  ExitCode?: number;
}

/**
 * Docker Compose test environment with automatic cleanup
 */
export class DockerComposeEnv {
  constructor(
    public readonly projectName: string,
    public readonly cwd: string,
  ) {}

  async [Symbol.asyncDispose]() {
    await cleanupServices(this.projectName, this.cwd);
  }

  async start(options: { build?: boolean; quiet?: boolean } = {}) {
    await startServices(this.projectName, this.cwd, options);
  }

  async getServiceHealth(serviceName: string) {
    return getServiceHealth(this.projectName, serviceName, this.cwd);
  }

  async getServiceState(serviceName: string) {
    return getServiceState(this.projectName, serviceName, this.cwd);
  }

  async getServiceLogs(serviceName: string) {
    return getServiceLogs(this.projectName, serviceName, this.cwd);
  }

  async waitForLogMessage(
    serviceName: string,
    expectedMessage: string,
    options?: { timeout?: number; interval?: number },
  ) {
    return waitForLogMessage(
      this.projectName,
      serviceName,
      expectedMessage,
      this.cwd,
      options,
    );
  }

  async execInService(serviceName: string, command: string) {
    return execInService(this.projectName, serviceName, command, this.cwd);
  }
}

/**
 * Create a Docker Compose test environment from current directory
 */
export function createDockerEnv(currentDir: string): DockerComposeEnv {
  const projectName = basename(currentDir);
  return new DockerComposeEnv(projectName, currentDir);
}

/**
 * Run docker compose commands
 */
export async function runCompose(
  projectName: string,
  args: string,
  cwd: string,
  options: DockerComposeOptions = {},
): Promise<string> {
  await using proc = Bun.spawn(
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
      throw new Error(error, {
        cause: new Error(
          `docker compose ${args} failed with exit code ${proc.exitCode}`,
        ),
      });
    }

    return output;
  }

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error(await new Response(proc.stderr).text(), {
      cause: new Error(
        `docker compose ${args} failed with exit code ${proc.exitCode}`,
      ),
    });
  }

  return "";
}

/**
 * Parse docker compose JSON output
 */
function parseDockerComposeJson(output: string): ServiceStatus[] {
  return JSON.parse(`[${output.trim().replace(/}\n{/g, "},{")}]`);
}

/**
 * Get service status
 */
export async function getServiceStatus(
  projectName: string,
  serviceName: string,
  cwd: string,
): Promise<ServiceStatus> {
  const output = await runCompose(
    projectName,
    `ps --format json ${serviceName}`,
    cwd,
    { capture: true },
  );
  const services = parseDockerComposeJson(output);
  if (!services[0]) {
    throw new Error(`Service ${serviceName} not found`);
  }
  return services[0];
}

/**
 * Get service health status
 */
export async function getServiceHealth(
  projectName: string,
  serviceName: string,
  cwd: string,
): Promise<string | undefined> {
  const status = await getServiceStatus(projectName, serviceName, cwd);
  return status.Health;
}

/**
 * Get service state
 */
export async function getServiceState(
  projectName: string,
  serviceName: string,
  cwd: string,
): Promise<string> {
  const status = await getServiceStatus(projectName, serviceName, cwd);
  return status.State;
}

/**
 * Get service logs
 */
export async function getServiceLogs(
  projectName: string,
  serviceName: string,
  cwd: string,
): Promise<string> {
  return await runCompose(projectName, `logs ${serviceName}`, cwd, {
    capture: true,
  });
}

/**
 * Setup docker test - returns project name from current directory
 */
export function setupDockerTest(currentDir: string): string {
  return basename(currentDir);
}

/**
 * Start docker compose services
 */
export async function startServices(
  projectName: string,
  cwd: string,
  options: { build?: boolean; quiet?: boolean } = {},
): Promise<void> {
  const args = ["up", "--detach"];

  if (options.build) {
    args.push("--build");
  }

  if (options.quiet) {
    args.push("--quiet-build", "--quiet-pull");
  }

  args.push("--wait");

  await runCompose(projectName, args.join(" "), cwd);
}

/**
 * Stop and cleanup docker compose services
 */
export async function cleanupServices(
  projectName: string,
  cwd: string,
): Promise<void> {
  await runCompose(projectName, "down --volumes", cwd);
}

/**
 * Execute command in a service
 */
export async function execInService(
  projectName: string,
  serviceName: string,
  command: string,
  cwd: string,
): Promise<void> {
  await runCompose(projectName, `exec ${serviceName} ${command}`, cwd);
}

/**
 * Wait for a specific string to appear in service logs
 */
export async function waitForLogMessage(
  projectName: string,
  serviceName: string,
  expectedMessage: string,
  cwd: string,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 30000; // 30 seconds default
  const interval = options.interval ?? 500; // 500ms default
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const logs = await getServiceLogs(projectName, serviceName, cwd);
    if (logs.includes(expectedMessage)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Timeout waiting for "${expectedMessage}" in ${serviceName} logs after ${timeout}ms`,
  );
}
