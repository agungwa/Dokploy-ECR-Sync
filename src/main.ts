import * as core from "@actions/core";
import { getEcrAuthToken } from "./ecr.js";
import { DokployClient } from "./dokploy-client.js";
import type { SyncAction } from "./types.js";

async function run(): Promise<void> {
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

    let action: SyncAction;
    let registryId: string | undefined;

    if (existing) {
      core.info(`Found existing registry (ID: ${existing.registryId}). Updating password...`);
      await client.updateRegistry({
        registryId: existing.registryId,
        username: registryUsername,
        password: ecrAuth.password,
        registryUrl: ecrAuth.registryUrl,
        imagePrefix: imagePrefix || undefined,
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
        imagePrefix: imagePrefix || undefined,
      });
      // Re-fetch to get the newly created registry ID
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
        registryUrl: ecrAuth.registryUrl,
      });
      core.info("Registry connection test passed.");
    }

    core.setOutput("registry-id", registryId || "");
    core.setOutput("action", action);

    if (!shouldRedeploy) {
      core.info("Redeploy skipped (redeploy=false).");
      return;
    }

    // Resolve application and compose IDs to redeploy
    let appIds: string[] = [];
    let composeIds: string[] = [];

    if (applicationIdsInput.trim()) {
      appIds = applicationIdsInput
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      core.info(`Using ${appIds.length} explicit application ID(s).`);
    } else if (registryId) {
      core.info("Auto-discovering applications using this registry...");
      const apps = await client.findAppsByRegistryId(registryId);
      appIds = apps.map((app) => app.applicationId);
      core.info(`Found ${appIds.length} application(s) using registry "${registryName}".`);
    }

    if (composeIdsInput.trim()) {
      composeIds = composeIdsInput
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
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
