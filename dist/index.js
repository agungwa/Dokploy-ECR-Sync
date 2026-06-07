"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var core = __toESM(require("@actions/core"));

// src/ecr.ts
var import_client_ecr = require("@aws-sdk/client-ecr");
async function getEcrAuthToken(region) {
  const client = new import_client_ecr.ECRClient({ region });
  const response = await client.send(new import_client_ecr.GetAuthorizationTokenCommand({}));
  const authData = response.authorizationData?.[0];
  if (!authData?.authorizationToken || !authData?.proxyEndpoint) {
    throw new Error("Failed to get ECR authorization token");
  }
  const decoded = Buffer.from(authData.authorizationToken, "base64").toString();
  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid ECR authorization token format");
  }
  const username = decoded.substring(0, colonIndex);
  const password = decoded.substring(colonIndex + 1);
  return {
    username,
    password,
    registryUrl: authData.proxyEndpoint.replace(/^https?:\/\//, "")
  };
}

// src/dokploy-client.ts
var DokployClient = class {
  baseUrl;
  apiKey;
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }
  async request(method, path, body) {
    const url = `${this.baseUrl}/api/${path}`;
    const options = {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json"
      }
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
    return response.json();
  }
  async listRegistries() {
    const result = await this.request("GET", "registry.all");
    return Array.isArray(result) ? result : [];
  }
  async findRegistryByName(name) {
    const registries = await this.listRegistries();
    return registries.find((r) => r.registryName === name);
  }
  async findRegistryByUrl(url) {
    const registries = await this.listRegistries();
    return registries.find((r) => r.registryUrl === url);
  }
  async createRegistry(params) {
    await this.request("POST", "registry.create", {
      registryName: params.registryName,
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      registryType: "cloud",
      imagePrefix: params.imagePrefix || null,
      ...params.serverId && { serverId: params.serverId }
    });
  }
  async updateRegistry(params) {
    await this.request("POST", "registry.update", {
      registryId: params.registryId,
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      ...params.registryName && { registryName: params.registryName },
      ...params.imagePrefix !== void 0 && {
        imagePrefix: params.imagePrefix || null
      }
    });
  }
  async testRegistry(params) {
    await this.request("POST", "registry.testRegistry", {
      username: params.username,
      password: params.password,
      registryUrl: params.registryUrl,
      registryType: "cloud"
    });
  }
  async listProjects() {
    const result = await this.request("GET", "project.all");
    return Array.isArray(result) ? result : [];
  }
  async findAppsByRegistryId(registryId) {
    const projects = await this.listProjects();
    const apps = [];
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
  async findComposesByRegistryId(registryId) {
    const projects = await this.listProjects();
    const composes = [];
    for (const project of projects) {
      for (const env of project.environments || []) {
        for (const compose of env.composes || []) {
          if (compose.registryId === registryId) {
            composes.push(compose);
          }
        }
      }
    }
    return composes;
  }
  async redeployApplication(applicationId) {
    await this.request("POST", "application.redeploy", { applicationId });
  }
  async deployApplication(applicationId) {
    await this.request("POST", "application.deploy", { applicationId });
  }
  async redeployCompose(composeId) {
    await this.request("POST", "compose.redeploy", { composeId });
  }
  async deployCompose(composeId) {
    await this.request("POST", "compose.deploy", { composeId });
  }
};

// src/main.ts
async function run() {
  try {
    const dokployUrl = core.getInput("dokploy-url", { required: true });
    const dokployApiKey = core.getInput("dokploy-api-key", { required: true });
    const awsRegion = core.getInput("aws-region", { required: true });
    const registryName = core.getInput("registry-name") || "AWS ECR";
    const registryUsername = core.getInput("registry-username") || "AWS";
    const imagePrefix = core.getInput("image-prefix") || "";
    const applicationIdsInput = core.getInput("application-ids") || "";
    const composeIdsInput = core.getInput("compose-ids") || "";
    const shouldRedeploy = core.getInput("redeploy") !== "false";
    const testConnection = core.getInput("test-connection") === "true";
    core.info("Fetching ECR auth token...");
    const ecrAuth = await getEcrAuthToken(awsRegion);
    core.info(
      `Got ECR token for registry: ${ecrAuth.registryUrl} (user: ${registryUsername})`
    );
    const client = new DokployClient(dokployUrl, dokployApiKey);
    core.info(`Looking for existing registry "${registryName}" in Dokploy...`);
    const existing = await client.findRegistryByName(registryName);
    let action;
    let registryId;
    if (existing) {
      core.info(`Found existing registry (ID: ${existing.registryId}). Updating password...`);
      await client.updateRegistry({
        registryId: existing.registryId,
        username: registryUsername,
        password: ecrAuth.password,
        registryUrl: ecrAuth.registryUrl,
        imagePrefix: imagePrefix || void 0
      });
      registryId = existing.registryId;
      action = "updated";
      core.info("Registry password updated.");
    } else {
      core.info(`No existing registry found. Creating "${registryName}"...`);
      await client.createRegistry({
        registryName,
        username: registryUsername,
        password: ecrAuth.password,
        registryUrl: ecrAuth.registryUrl,
        imagePrefix: imagePrefix || void 0
      });
      const created = await client.findRegistryByName(registryName);
      registryId = created?.registryId;
      action = "created";
      core.info(`Registry created (ID: ${registryId}).`);
    }
    if (testConnection) {
      core.info("Testing registry connection...");
      await client.testRegistry({
        username: registryUsername,
        password: ecrAuth.password,
        registryUrl: ecrAuth.registryUrl
      });
      core.info("Registry connection test passed.");
    }
    core.setOutput("registry-id", registryId || "");
    core.setOutput("action", action);
    if (!shouldRedeploy) {
      core.info("Redeploy skipped (redeploy=false).");
      return;
    }
    let appIds = [];
    let composeIds = [];
    if (applicationIdsInput.trim()) {
      appIds = applicationIdsInput.split(",").map((id) => id.trim()).filter(Boolean);
      core.info(`Using ${appIds.length} explicit application ID(s).`);
    } else if (registryId) {
      core.info("Auto-discovering applications using this registry...");
      const apps = await client.findAppsByRegistryId(registryId);
      appIds = apps.map((app) => app.applicationId);
      core.info(`Found ${appIds.length} application(s) using registry "${registryName}".`);
    }
    if (composeIdsInput.trim()) {
      composeIds = composeIdsInput.split(",").map((id) => id.trim()).filter(Boolean);
      core.info(`Using ${composeIds.length} explicit compose ID(s).`);
    } else if (registryId) {
      core.info("Auto-discovering compose services using this registry...");
      const composes = await client.findComposesByRegistryId(registryId);
      composeIds = composes.map((c) => c.composeId);
      core.info(`Found ${composeIds.length} compose service(s) using registry "${registryName}".`);
    }
    if (appIds.length === 0 && composeIds.length === 0) {
      core.info("No applications or compose services to redeploy.");
      return;
    }
    for (const appId of appIds) {
      core.info(`Redeploying application ${appId}...`);
      await client.redeployApplication(appId);
      core.info(`Application ${appId} redeploy triggered.`);
    }
    for (const composeId of composeIds) {
      core.info(`Redeploying compose ${composeId}...`);
      await client.redeployCompose(composeId);
      core.info(`Compose ${composeId} redeploy triggered.`);
    }
    core.info(`Done. ${appIds.length} application(s) and ${composeIds.length} compose service(s) redeployed.`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}
run();
