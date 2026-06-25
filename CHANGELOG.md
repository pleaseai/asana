# Changelog

## [0.7.0](https://github.com/pleaseai/asana/compare/v0.6.0...v0.7.0) (2026-06-25)


### Features

* **auth:** support brokered auth for sandbox egress ([#46](https://github.com/pleaseai/asana/issues/46)) ([71b3e64](https://github.com/pleaseai/asana/commit/71b3e64cce1cb5e480bd52d57b101f0f03bba2da))

## [0.6.0](https://github.com/pleaseai/asana/compare/v0.5.1...v0.6.0) (2026-06-23)


### Features

* **plugin:** package asana-cli skill as a Claude Code plugin ([#41](https://github.com/pleaseai/asana/issues/41)) ([8f85083](https://github.com/pleaseai/asana/commit/8f850836f38e9f5708cd6a829ce582dca7104feb))
* structured agent-readable error output (AXI §6, Phase 1) ([#42](https://github.com/pleaseai/asana/issues/42)) ([ada6138](https://github.com/pleaseai/asana/commit/ada6138ecdadc8e8513a7506e043e1e8f4446c52))


### Bug Fixes

* **docs:** use canonical www.conventionalcommits.org URL ([#40](https://github.com/pleaseai/asana/issues/40)) ([daa9694](https://github.com/pleaseai/asana/commit/daa9694745374bc28dc76f583697fa2faa1f16ff))
* **task:** apply due date on `task create` via --due-on ([#34](https://github.com/pleaseai/asana/issues/34)) ([b342180](https://github.com/pleaseai/asana/commit/b342180cc3531bca84ab168eb928136484d6de6f))
* **task:** honor global --format in `task list` ([#35](https://github.com/pleaseai/asana/issues/35)) ([eca2d2f](https://github.com/pleaseai/asana/commit/eca2d2fb48893749689f594588026b6f90e9deb3))


### Documentation

* **skill:** add asana-cli Claude Code skill ([#37](https://github.com/pleaseai/asana/issues/37)) ([619826c](https://github.com/pleaseai/asana/commit/619826c0a3a9a3fd2d89e96d21ff13ffe7fb48fb))

## [0.5.1](https://github.com/pleaseai/asana/compare/v0.5.0...v0.5.1) (2026-06-19)


### Bug Fixes

* **auth:** repair PAT login by validating token with asana@3 SDK ([#31](https://github.com/pleaseai/asana/issues/31)) ([97d7640](https://github.com/pleaseai/asana/commit/97d7640562a7d82dbd7202a874b46c67665ad3bd))

## [0.5.0](https://github.com/pleaseai/asana/compare/v0.4.0...v0.5.0) (2026-06-10)


### Features

* add attachments, custom fields, batch operations, and search (Phase 6) ([#28](https://github.com/pleaseai/asana/issues/28)) ([d15ab26](https://github.com/pleaseai/asana/commit/d15ab26b9c3bd720e68e3f769ae7587c997d363f)), closes [#19](https://github.com/pleaseai/asana/issues/19)
* add subtask and dependency commands ([#16](https://github.com/pleaseai/asana/issues/16)) ([#26](https://github.com/pleaseai/asana/issues/26)) ([e75a3f8](https://github.com/pleaseai/asana/commit/e75a3f858391c6f5b62500ab40a5fdbf9b8de06b))
* add team, workspace, and user management commands ([#29](https://github.com/pleaseai/asana/issues/29)) ([da0a6db](https://github.com/pleaseai/asana/commit/da0a6db45f12e290bd5200906d77b8c71227817e))
* **oauth:** add PKCE, secure state, scope management, and OOB flow ([#24](https://github.com/pleaseai/asana/issues/24)) ([bc404c9](https://github.com/pleaseai/asana/commit/bc404c9e670856daa93e47f7ac68fa6acd8f2b09))
* phase 4 collaboration features (comments, followers, tags) ([#30](https://github.com/pleaseai/asana/issues/30)) ([c2528ea](https://github.com/pleaseai/asana/commit/c2528ea4fc84f7c4faafdcee31023f5f3dd038d3))


### Documentation

* add please workspace and ARCHITECTURE.md ([#25](https://github.com/pleaseai/asana/issues/25)) ([778d835](https://github.com/pleaseai/asana/commit/778d8350d777f8436f01fd3f7bda7d63883f1a1f))
* update install script command from 'sh' to 'bash' ([6de56ef](https://github.com/pleaseai/asana/commit/6de56ef275c64193535da1ce206d1668806279fc))
* update install script command from 'sh' to 'bash' ([f823b5a](https://github.com/pleaseai/asana/commit/f823b5a2610857f18cb3118253ee057f1e517d9b))

## [0.4.0](https://github.com/pleaseai/asana/compare/v0.3.0...v0.4.0) (2025-10-30)


### Features

* Phase 2 - Project and Section Management ([#21](https://github.com/pleaseai/asana/issues/21)) ([ce6627c](https://github.com/pleaseai/asana/commit/ce6627c88ab804b6165beec3c14466bc29f15576))

## [0.3.0](https://github.com/pleaseai/asana/compare/v0.2.0...v0.3.0) (2025-10-30)


### Features

* integrate @pleaseai/cli-toolkit for enhanced TOON output ([#13](https://github.com/pleaseai/asana/issues/13)) ([cbb7f20](https://github.com/pleaseai/asana/commit/cbb7f2081043b9ff897d4cdda7eac64d09119fc1))
* Phase 1 - Task Update and Move Commands ([#20](https://github.com/pleaseai/asana/issues/20)) ([158369d](https://github.com/pleaseai/asana/commit/158369dcc32722734a03f2b9005f9e4886bd72e5))


### Bug Fixes

* use GitHub App token for Homebrew formula updates ([36d202d](https://github.com/pleaseai/asana/commit/36d202d32067a43a8dd8e6f78eace21dc2c36ef9))


### Documentation

* rewrite README in English with documentation links ([#5](https://github.com/pleaseai/asana/issues/5)) ([854282d](https://github.com/pleaseai/asana/commit/854282d51458889b7a0c445cbba21e96428be6f9))

## [0.2.0](https://github.com/pleaseai/asana/compare/v0.1.0...v0.2.0) (2025-10-25)


### Features

* add .env file with Asana access token and dotenv public key ([128f2aa](https://github.com/pleaseai/asana/commit/128f2aa2731296872892ad5a81cb109e12167802))
* add dotenvx support and comprehensive E2E tests ([f2e1201](https://github.com/pleaseai/asana/commit/f2e1201e58ad370b1707a7753e6a0d9e250e19a0))
* add manual E2E test workflows for GitHub Actions ([9cc7384](https://github.com/pleaseai/asana/commit/9cc738461cba01986e0099877028148830ec78b2))
* enable JSON module resolution in TypeScript configuration ([ddf3447](https://github.com/pleaseai/asana/commit/ddf344756a1f499faa8f9089544b38d9ac3c0dfe))
* implement distribution strategy with Homebrew, installation script, and self-update ([#4](https://github.com/pleaseai/asana/issues/4)) ([cf89495](https://github.com/pleaseai/asana/commit/cf89495d07581ebcd88a2a90c388f7b138899f91))
* initial Asana CLI implementation ([c6b1bdf](https://github.com/pleaseai/asana/commit/c6b1bdfe4ab21ab02022454ff4027bc8e6e54c5e))
* update Asana access token and rename dotenv key in workflows ([d8b4c7f](https://github.com/pleaseai/asana/commit/d8b4c7f53c0f7fbab67238b194350981ea81f8cc))
* update Asana access token and workspace in .env file ([eb9c112](https://github.com/pleaseai/asana/commit/eb9c112db1e7fec9936686072323fb3f7060101d))


### Documentation

* add comprehensive Asana Node.js client documentation ([b2cf0dc](https://github.com/pleaseai/asana/commit/b2cf0dcf8a3f379fbf2a20530a6efe3ef00a9037))
* add environment setup guide and E2E test helpers ([e4678f6](https://github.com/pleaseai/asana/commit/e4678f62b0a75760d59e4f790f9a3c579c63def1))
* update documentation structure and correct file paths ([5a11085](https://github.com/pleaseai/asana/commit/5a11085656460bc09292c2060a6c4962dce75495))
