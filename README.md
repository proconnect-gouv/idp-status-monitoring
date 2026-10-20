# IDP Status Monitoring

This application provides a way to access status endpoints available on the **RIE (Réseau Interministériel de l'État)** from the public internet, for the purpose of displaying their status on our public status page.

HTTP requests initiated by the status platform are converted into messages in a **RabbitMQ** queue by the _producer_, and then transformed back into HTTP calls within the RIE by the _consumer_.

## Docker Build

Build specific services:

```bash
# Consumer only
docker build --target consumer --tag monitoring-consumer .

# Producer only
docker build --target producer --tag monitoring-producer .

# Both services
docker build --target monitoring --tag monitoring .
```

## Usage

```bash
# Run consumer
docker run monitoring-consumer

# Run producer
docker run monitoring-producer

# Run both (defaults to consumer)
docker run monitoring
# Or explicitly run producer
docker run monitoring producer
```

## Release

Versions follow monthly calendar versioning (`YYYY.MM.PATCH`), released through
[`proconnect-gouv/release-action`](https://github.com/proconnect-gouv/release-action)
(workflow **🚢 Release It !**, on every push to `main`):

1. After each merge to `main`, the action opens or updates the
   `🔖 release <version>` pull request from `release-it/next`, bumping
   `package.json` and prepending the version section to `CHANGELOG.md`.
2. Merging that pull request tags the version (no `v` prefix) and publishes a
   GitHub release with the `CHANGELOG.md` section as notes.
3. The publish job then dispatches **🐳 Docker Build** on the tag:
   `ghcr.io/proconnect-gouv/idp-status-monitoring/{consumer,producer}:<version>`.

Describe a user-facing change with a Markdown file in `.release-it-changeset/`
(see the
[action documentation](https://github.com/proconnect-gouv/release-action#%EF%B8%8F-changesets)).
