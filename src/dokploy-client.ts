import type {
  DokployRegistry,
  DokployProject,
  DokployApplication,
} from "./types.js";

export class DokployClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Dokploy API error ${response.status} on ${method} ${path}: ${errorBody}`
      );
    }

    return response.json() as Promise<T>;
  }

  async listRegistries(): Promise<DokployRegistry[]> {
    const result = await this.request<DokployRegistry[]>("GET", "registry.all");
    return Array.isArray(result) ? result : [];
  }

  async findRegistryByName(
    name: string
  ): Promise<DokployRegistry | undefined> {
    const registries = await this.listRegistries();
    return registries.find((r) => r.registryName === name);
  }

  async findRegistryByUrl(
    url: string
  ): Promise<DokployRegistry | undefined> {
    const registries = await this.listRegistries();
    return registries.find((r) => r.registryUrl === url);
  }

  async createRegistry(params: {
    registryName: string;
    username: string;
    password: string;
    registryUrl: string;
    imagePrefix?: string;
    serverId?: string;
  }): Promise<void> {
    await this.request("POST", "registry.create", {
      registryName: params.registryName,
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      registryType: "cloud",
      imagePrefix: params.imagePrefix || null,
      ...(params.serverId && { serverId: params.serverId }),
    });
  }

  async updateRegistry(params: {
    registryId: string;
    username: string;
    password: string;
    registryUrl: string;
    registryName?: string;
    imagePrefix?: string;
  }): Promise<void> {
    await this.request("POST", "registry.update", {
      registryId: params.registryId,
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      ...(params.registryName && { registryName: params.registryName }),
      ...(params.imagePrefix !== undefined && {
        imagePrefix: params.imagePrefix || null,
      }),
    });
  }

  async testRegistry(params: {
    username: string;
    password: string;
    registryUrl: string;
  }): Promise<void> {
    await this.request("POST", "registry.testRegistry", {
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      registryType: "cloud",
    });
  }

  async listProjects(): Promise<DokployProject[]> {
    const result = await this.request<DokployProject[]>("GET", "project.all");
    return Array.isArray(result) ? result : [];
  }

  async findAppsByRegistryId(registryId: string): Promise<DokployApplication[]> {
    const projects = await this.listProjects();
    const apps: DokployApplication[] = [];

    for (const project of projects) {
      for (const env of project.environments || []) {
        for (const app of env.applications || []) {
          if (app.registryId === registryId) {
            apps.push(app);
          }
        }
      }
    }

    return apps;
  }

  async redeployApplication(applicationId: string): Promise<void> {
    await this.request("POST", "application.redeploy", { applicationId });
  }

  async deployApplication(applicationId: string): Promise<void> {
    await this.request("POST", "application.deploy", { applicationId });
  }
}
