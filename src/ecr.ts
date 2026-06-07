import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";
import type { EcrAuth } from "./types.js";

export async function getEcrAuthToken(region: string): Promise<EcrAuth> {
  const client = new ECRClient({ region });
  const response = await client.send(new GetAuthorizationTokenCommand({}));

  const authData = response.authorizationData?.[0];
  if (!authData?.authorizationToken || !authData?.proxyEndpoint) {
    throw new Error("Failed to get ECR authorization token");
  }

  // authorizationToken is base64 encoded "AWS:password"
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
    registryUrl: authData.proxyEndpoint.replace(/^https?:\/\//, ""),
  };
}
