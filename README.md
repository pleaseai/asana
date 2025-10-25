# Asana CLI

[![CI](https://github.com/pleaseai/asana/actions/workflows/ci.yml/badge.svg)](https://github.com/pleaseai/asana/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/pleaseai/asana/branch/main/graph/badge.svg)](https://codecov.io/gh/pleaseai/asana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Asana CLI를 사용하여 명령줄에서 Asana 작업을 관리하세요.

## 특징

- ✅ OAuth 2.0 및 Personal Access Token 인증 지원
- ✅ 작업 생성, 조회, 완료, 삭제
- ✅ 자동 토큰 갱신 (OAuth)
- ✅ 기본 workspace 설정
- ✅ Bun으로 구축된 빠른 실행 속도

## 설치

### 방법 1: Homebrew (macOS/Linux - 추천)

가장 쉬운 설치 방법입니다:

```bash
# Tap 추가
brew tap pleaseai/tap

# 설치
brew install asana-cli

# 버전 확인
asana --version
```

### 방법 2: 설치 스크립트 (모든 플랫폼)

한 줄로 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/pleaseai/asana/main/scripts/install.sh | sh
```

설치 스크립트는 자동으로:
- OS 및 아키텍처 감지 (macOS/Linux, x64/arm64)
- 최신 릴리스 다운로드
- 체크섬 검증
- `~/.local/bin`에 설치

**참고:** 설치 후 `~/.local/bin`이 PATH에 없다면 추가하세요:

```bash
# bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc

# zsh
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.zshrc
```

### 방법 3: 개발 환경 (소스에서)

개발이나 기여를 위한 방법:

```bash
git clone https://github.com/pleaseai/asana.git
cd asana
bun install
bun run dev --help
```

## 인증 설정

### 방법 1: Personal Access Token (PAT) - 추천 (빠른 설정)

가장 빠르고 간단한 방법입니다. CLI 도구에 적합합니다.

1. [Asana Developer Console](https://app.asana.com/0/my-apps)에서 Personal Access Token 생성
2. 토큰으로 로그인:

```bash
bun run dev auth login --token YOUR_TOKEN
```

**참고:** [PAT 문서](https://developers.asana.com/docs/personal-access-token)

### 방법 2: OAuth 2.0 (멀티유저 앱)

여러 사용자를 지원하는 앱이나 더 나은 보안이 필요한 경우.

1. [Asana Developer Console](https://app.asana.com/0/my-apps)에서 OAuth 앱 생성
   - Redirect URI: `http://localhost:8080/callback`

2. 환경 변수 설정:

```bash
export ASANA_CLIENT_ID=your_client_id
export ASANA_CLIENT_SECRET=your_client_secret
```

또는 `.env` 파일 생성:

```bash
cp .env.example .env
# .env 파일 편집하여 Client ID와 Secret 추가
```

3. OAuth 로그인:

```bash
bun run dev auth login
```

브라우저가 자동으로 열리고 Asana 인증 페이지로 이동합니다.

**참고:**

- [OAuth 문서](https://developers.asana.com/docs/getting-started-with-asana-oauth)
- [인증 개요](https://developers.asana.com/docs/authentication)

## 업데이트

### Homebrew 사용자

```bash
brew upgrade asana-cli
```

### 설치 스크립트 사용자

```bash
asana self-update
```

`self-update` 명령어는 자동으로:
- GitHub Releases에서 최신 버전 확인
- 새 버전 다운로드 및 체크섬 검증
- 자동 업데이트 및 실패 시 롤백

### 업데이트 확인만 하기

```bash
asana self-update --check
```

## 사용법

### 인증 관리

```bash
# 로그인 (OAuth)
asana auth login

# 로그인 (PAT) - 추천
asana auth login --token YOUR_TOKEN

# 기본 workspace와 함께 로그인
asana auth login --token YOUR_TOKEN -w WORKSPACE_ID

# 현재 사용자 정보 확인
asana auth whoami

# 로그아웃
asana auth logout
```

### 작업 관리

```bash
# 작업 생성
asana task create -n "새로운 작업" -d "작업 설명" -w WORKSPACE_ID

# 프로젝트에 작업 생성
asana task create -n "작업 이름" -p PROJECT_ID -w WORKSPACE_ID

# 담당자와 마감일 지정
asana task create -n "작업" -a USER_ID --due 2025-12-31 -w WORKSPACE_ID

# 작업 목록 조회 (내 작업)
asana task list -a me -w WORKSPACE_ID

# 프로젝트의 작업 목록
asana task list -p PROJECT_ID

# 완료된 작업 포함
asana task list -a me -c -w WORKSPACE_ID

# 작업 상세 정보
asana task get TASK_ID

# 작업 완료 처리
asana task complete TASK_ID

# 작업 삭제
asana task delete TASK_ID
```

**개발 모드:** `bun run dev` 명령어를 사용하여 소스에서 직접 실행할 수 있습니다.

## 릴리스 및 배포

프로젝트는 GitHub Actions를 통해 자동으로 빌드 및 배포됩니다.

### 로컬 빌드

개발 목적으로 로컬에서 바이너리를 빌드할 수 있습니다:

```bash
bun run build
```

컴파일된 바이너리 실행:

```bash
./asana auth login --token YOUR_TOKEN
./asana task list -a me
```

### 릴리스 프로세스

1. 새 버전 태그 생성: `git tag v0.x.x`
2. 태그 푸시: `git push --tags`
3. GitHub Actions가 자동으로:
   - 멀티 플랫폼 바이너리 빌드 (macOS/Linux, x64/arm64)
   - 체크섬 생성
   - GitHub Release 생성
   - Homebrew Formula 업데이트

## 환경 변수

이 프로젝트는 [dotenvx](https://dotenvx.com/)를 사용하여 암호화된 환경 변수 관리를 지원합니다.

### 설정 방법

1. `.env` 파일 생성:

```bash
cp .env.example .env
```

2. 환경 변수 설정:

```bash
# OAuth 인증용 (선택사항)
ASANA_CLIENT_ID=your_client_id
ASANA_CLIENT_SECRET=your_client_secret

# PAT 인증용 (선택사항, --token 대신 사용 가능)
ASANA_ACCESS_TOKEN=your_token

# 기본 workspace (선택사항)
ASANA_WORKSPACE=workspace_id
```

3. (추천) 환경 변수 암호화:

```bash
bun run env:encrypt
```

4. 암호화된 환경으로 실행:

```bash
bun run dev:secure auth login
bun run test:e2e:secure
```

자세한 설정 방법은 [Environment Setup Guide](dev-docs/ENVIRONMENT_SETUP.md)를 참고하세요.

## 설정 파일

인증 정보는 `~/.asana-cli/config.json`에 저장됩니다.

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "authType": "oauth",
  "workspace": "...",
  "expiresAt": 1234567890
}
```

## 개발

```bash
# 개발 모드 실행
bun run dev auth login

# Unit 테스트 실행 (E2E 제외)
bun test

# 모든 테스트 실행 (unit + E2E)
bun test:all

# E2E 테스트만 실행 (실제 Asana API 호출)
bun test:e2e

# E2E 테스트 (dotenvx 사용, 권장)
bun test:e2e:secure

# 테스트 커버리지 (unit 테스트만)
bun test:coverage

# Lint
bun run lint

# Lint 자동 수정
bun run lint:fix
```

### E2E 테스트 설정

E2E 테스트는 실제 Asana API와 상호작용합니다:

**로컬 실행:**

1. `.env` 파일에 `ASANA_ACCESS_TOKEN`과 `ASANA_WORKSPACE` 설정
2. `bun test:e2e` 또는 `bun test:e2e:secure` 실행

**GitHub Actions (Manual):**

- Actions 탭에서 "E2E Tests (Manual)" 워크플로우를 수동으로 실행
- Repository Secrets에 `ASANA_ACCESS_TOKEN`과 `ASANA_WORKSPACE` 설정 필요
- [Workflow Guide](.github/workflows/README.md) 참고

자세한 내용은 [E2E Test Guide](tests/e2e/README.md)를 참고하세요.

## 기술 스택

- **Runtime**: [Bun](https://bun.sh)
- **SDK**: [Asana Node.js SDK](https://github.com/Asana/node-asana)
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **Styling**: [Chalk](https://github.com/chalk/chalk)

## 참고 문서

### 개발자 문서

- [Asana Node.js Client Documentation](dev-docs/ASANA_NODE_CLIENT.md) - Node.js 클라이언트 API 레퍼런스
- [Environment Setup Guide](dev-docs/ENVIRONMENT_SETUP.md) - 환경 설정 가이드
- [E2E Test Guide](tests/e2e/README.md) - E2E 테스트 가이드

### 공식 Asana 문서

- [Asana API 문서](https://developers.asana.com/docs)
- [Asana Node.js SDK](https://github.com/Asana/node-asana)
- [Personal Access Token](https://developers.asana.com/docs/personal-access-token)
- [OAuth 2.0 가이드](https://developers.asana.com/docs/getting-started-with-asana-oauth)
- [인증 개요](https://developers.asana.com/docs/authentication)

## 라이선스

Private

## 작성자

이민수 (Minsu Lee)

- GitHub: [@amondnet](https://github.com/amondnet)
