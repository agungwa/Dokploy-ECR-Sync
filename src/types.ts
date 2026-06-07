export interface EcrAuth {
  username: string;
  password: string;
  registryUrl: string;
}

export interface DokployRegistry {
  registryId: string;
  registryName: string;
  username: string;
  password: string;
  registryUrl: string;
  registryType: string;
  imagePrefix: string | null;
  serverId: string | null;
  createdAt: string;
  organizationId: string | null;
}

export interface DokployApplication {
  applicationId: string;
  name: string;
  appName: string;
  registryId: string | null;
  environmentId: string;
}

export interface DokployProject {
  projectId: string;
  name: string;
  environments: DokployEnvironment[];
}

export interface DokployEnvironment {
  environmentId: string;
  name: string;
  appName: string;
  applications: DokployApplication[];
}

export type SyncAction = "created" | "updated";
