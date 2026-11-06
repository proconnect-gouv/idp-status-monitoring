# Changelog

## [2026.11.1](https://github.com/proconnect-gouv/idp-status-monitoring/compare/2026.11.0...2026.11.1) (2026-11-06)

### Dépendances

- ⬆️ Lock file maintenance ([#201](https://github.com/proconnect-gouv/idp-status-monitoring/issues/201)) ([5d3c060](https://github.com/proconnect-gouv/idp-status-monitoring/commit/5d3c060750f1164a400ca266a3745415bac48ce8))
- ⬆️ Bump amqp-connection-manager from 5.0.0 to 5.0.1 ([#195](https://github.com/proconnect-gouv/idp-status-monitoring/issues/195)) ([53f9ac6](https://github.com/proconnect-gouv/idp-status-monitoring/commit/53f9ac6a0600a5d2bddfc7674edcadcccbbc1235))
- ⬆️ Bump hono from 4.13.14 to 4.13.16 ([#198](https://github.com/proconnect-gouv/idp-status-monitoring/issues/198)) ([e89b0cd](https://github.com/proconnect-gouv/idp-status-monitoring/commit/e89b0cd57633041d90a17e2866d19203bed37146))
- ⬆️ Bump docker/login-action from v4.7.0 to v4.8.0 ([#199](https://github.com/proconnect-gouv/idp-status-monitoring/issues/199)) ([78790b6](https://github.com/proconnect-gouv/idp-status-monitoring/commit/78790b66ea11e64f4262eefd6e73a05ba6c4203b))
- ⬆️ Bump ubuntu from 24.04 to 26.04 ([#200](https://github.com/proconnect-gouv/idp-status-monitoring/issues/200)) ([0e03482](https://github.com/proconnect-gouv/idp-status-monitoring/commit/0e0348210575db51c483e753c83bbc2d0e361cc6))
- ⬆️ Bump docker/setup-buildx-action from v4.4.0 to v4.4.1 ([#197](https://github.com/proconnect-gouv/idp-status-monitoring/issues/197)) ([d789fa9](https://github.com/proconnect-gouv/idp-status-monitoring/commit/d789fa944368e13ebf540379d22234b38a8a2997))
- ⬆️ Bump amqplib from 2.2.0 to 2.2.1 ([#196](https://github.com/proconnect-gouv/idp-status-monitoring/issues/196)) ([97ddcac](https://github.com/proconnect-gouv/idp-status-monitoring/commit/97ddcac3aa8f63875dc9dba6c2852a9b38aea1dc))

### Divers

- Configure Renovate ([#190](https://github.com/proconnect-gouv/idp-status-monitoring/issues/190)) ([e2f8f52](https://github.com/proconnect-gouv/idp-status-monitoring/commit/e2f8f524f5d1c4d9140fee836a85bd60f882ca14))

## [2026.11.0](https://github.com/proconnect-gouv/idp-status-monitoring/compare/2026.10.1...2026.11.0) (2026-11-04)

### Changements

- Ajout de `GET /idp/:name/readyz` : diagnostic détaillé d'un FI au format readyz de Kubernetes (`[+]`/`[-]` par vérification : rpc, dns, connect, tls, http, response, json, response-time), avec 200 si tout passe, 503 sinon, 404 pour un FI inconnu.

### Ajouté

- ✨ diagnose one IdP step by step on /idp/:name/readyz ([#189](https://github.com/proconnect-gouv/idp-status-monitoring/issues/189)) ([09a541e](https://github.com/proconnect-gouv/idp-status-monitoring/commit/09a541eda24829af956d8f3592b47a037e87d835))

### Dépendances

- :arrow_upper_right: [patch](deps-dev): Bump @types/bun ([#186](https://github.com/proconnect-gouv/idp-status-monitoring/issues/186)) ([9bd27f7](https://github.com/proconnect-gouv/idp-status-monitoring/commit/9bd27f729f337175365fd912f5dcd3928befbea1))
- :arrow_upper_right: [patch](deps): Bump docker/login-action ([#185](https://github.com/proconnect-gouv/idp-status-monitoring/issues/185)) ([c1cacf0](https://github.com/proconnect-gouv/idp-status-monitoring/commit/c1cacf06b287fd5d933c39188c95271da32ab458))
- :arrow_upper_right: [patch](deps): Bump oven/bun ([#184](https://github.com/proconnect-gouv/idp-status-monitoring/issues/184)) ([a0bc11a](https://github.com/proconnect-gouv/idp-status-monitoring/commit/a0bc11a3953f55cbddf4a074bcf67d588cf95b3f))
- :arrow_upper_right: [patch](deps): Bump hono from 4.13.13 to 4.13.14 ([#187](https://github.com/proconnect-gouv/idp-status-monitoring/issues/187)) ([c3c766e](https://github.com/proconnect-gouv/idp-status-monitoring/commit/c3c766e5f7279e7845968744a94427db7c8154eb))

## [2026.10.1](https://github.com/proconnect-gouv/idp-status-monitoring/compare/2026.10.0...2026.10.1) (2026-10-20)

### Ajouté

- ✨ log one JSON line per event, with a level for Grafana Loki ([#181](https://github.com/proconnect-gouv/idp-status-monitoring/issues/181)) ([425c8e9](https://github.com/proconnect-gouv/idp-status-monitoring/commit/425c8e9d955b003a26de09d5039cfa082e48caf1))

## [2026.10.0](https://github.com/proconnect-gouv/idp-status-monitoring/releases/tag/2026.10.0)

### Ajouté

- 🎉 first versioned release: `consumer` and `producer` images tagged `2026.10.0` on ghcr.io
