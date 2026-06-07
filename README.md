# Dokploy ECR Sync

A GitHub Action that syncs AWS ECR credentials to your [Dokploy](https://dokploy.com) instance and optionally redeploys applications and compose services.

AWS ECR auth tokens expire every **12 hours**. This action fetches a fresh token and updates (or creates) the registry credential in Dokploy, then triggers redeployment of the affected applications and/or compose services.

## Features

- Fetches fresh ECR auth token via AWS SDK
- Creates or updates registry credentials in Dokploy
- Auto-discovers applications and compose services using the registry, or accepts explicit IDs
- Supports both applications and compose services for redeployment
- Optionally tests the registry connection
- Supports both OIDC and access key AWS authentication

## Usage

### Basic (workflow_dispatch)

```yaml
name: Sync ECR Credentials

on:
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-ecr-role
          aws-region: ap-southeast-1

      - name: Sync ECR to Dokploy
        uses: agungwa/Dokploy-ECR-Sync@v1.0.0
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
          aws-region: ap-southeast-1
```

### With Scheduled Refresh (every 6 hours)

```yaml
name: Sync ECR Credentials

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-ecr-role
          aws-region: ap-southeast-1

      - name: Sync ECR to Dokploy
        uses: agungwa/Dokploy-ECR-Sync@v1.0.0
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
          aws-region: ap-southeast-1
          redeploy: true
```

### Before Deploying an App

Use this in your CI/CD pipeline to refresh credentials right before deploying:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1

      - name: Refresh ECR Credentials & Redeploy
        uses: agungwa/Dokploy-ECR-Sync@v1.0.0
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
          aws-region: ap-southeast-1
          application-ids: "your-app-id-here"
          redeploy: true
```

### Redeploy Compose Services

To redeploy compose (Docker Compose) services instead of or alongside applications:

```yaml
- uses: agungwa/Dokploy-ECR-Sync@v1.0.0
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
    aws-region: ap-southeast-1
    compose-ids: "compose-id-1,compose-id-2"
    redeploy: true
```

You can combine both:

```yaml
- uses: agungwa/Dokploy-ECR-Sync@v1.0.0
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
    aws-region: ap-southeast-1
    application-ids: "app-id-1"
    compose-ids: "compose-id-1"
    redeploy: true
```

### First-Time Setup (Create Registry)

On first run, if no registry named "AWS ECR" exists in Dokploy, the action creates one automatically:

```yaml
- uses: agungwa/Dokploy-ECR-Sync@v1.0.0
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    dokploy-api-key: ${{ secrets.DOKPLOY_API_KEY }}
    aws-region: ap-southeast-1
    registry-name: "AWS ECR"
    image-prefix: "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com"
    test-connection: true
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `dokploy-url` | yes | — | Your Dokploy instance URL (e.g. `https://dokploy.example.com`) |
| `dokploy-api-key` | yes | — | Dokploy API key (store as a GitHub secret) |
| `aws-region` | yes | — | AWS region for ECR (e.g. `ap-southeast-1`) |
| `registry-name` | no | `AWS ECR` | Display name for the registry in Dokploy |
| `image-prefix` | no | — | Optional image prefix for the registry |
| `application-ids` | no | — | Comma-separated application IDs to redeploy. If empty, auto-discovers apps using the registry |
| `compose-ids` | no | — | Comma-separated compose service IDs to redeploy. If empty, auto-discovers compose services using the registry |
| `redeploy` | no | `true` | Whether to redeploy applications and compose services after updating credentials |
| `test-connection` | no | `false` | Test the registry connection after create/update |

## Outputs

| Output | Description |
| --- | --- |
| `registry-id` | The Dokploy registry ID |
| `action` | Action taken: `created` or `updated` |

## How It Works

```
1. Fetch ECR auth token via AWS SDK
   └─ ecr:GetAuthorizationToken → { username: "AWS", password: <token>, registryUrl }

2. Find existing registry in Dokploy
   └─ GET /registry.all → match by registryName

3. Create or update
   ├─ Found   → POST /registry.update { registryId, password }
   └─ Not found → POST /registry.create { name, username, password, url }

4. Redeploy services
   ├─ Applications
   │  ├─ If application-ids provided → use those
   │  └─ Otherwise → GET /project.all → find apps with matching registryId
   │  └─ POST /application.redeploy for each
   └─ Compose services
      ├─ If compose-ids provided → use those
      └─ Otherwise → GET /project.all → find composes with matching registryId
      └─ POST /compose.redeploy for each
```

## Required AWS Permissions

The AWS credentials used by this action need the following permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    }
  ]
}
```

If you also need to push images, add `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` scoped to your repositories.

## Required GitHub Secrets

| Secret | Description |
| --- | --- |
| `DOKPLOY_URL` | Your Dokploy instance URL |
| `DOKPLOY_API_KEY` | API key generated in Dokploy admin settings |
| `AWS_ACCESS_KEY_ID` | (if using access keys) AWS access key |
| `AWS_SECRET_ACCESS_KEY` | (if using access keys) AWS secret key |

For OIDC authentication, configure your AWS IAM role to trust your GitHub repository as a principal. See [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) for setup instructions.

## Finding Your Application or Compose ID

You can get IDs via the Dokploy API:

```bash
curl -X GET "https://your-dokploy-instance.com/api/project.all" \
  -H "x-api-key: YOUR_API_KEY"
```

- **Application ID**: look for `applicationId` in the response under each project's environments → `applications`
- **Compose ID**: look for `composeId` under each project's environments → `composes`

Alternatively, find the ID from the Dokploy dashboard URL:
- Application: `.../services/application/<APPLICATION_ID>`
- Compose: `.../services/compose/<COMPOSE_ID>`

## License

MIT
