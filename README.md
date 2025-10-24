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

```bash
bun install
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

## 사용법

### 인증 관리

```bash
# 로그인 (OAuth)
bun run dev auth login

# 로그인 (PAT)
bun run dev auth login --token YOUR_TOKEN

# 기본 workspace와 함께 로그인
bun run dev auth login --token YOUR_TOKEN -w WORKSPACE_ID

# 현재 사용자 정보 확인
bun run dev auth whoami

# 로그아웃
bun run dev auth logout
```

### 작업 관리

```bash
# 작업 생성
bun run dev task create -n "새로운 작업" -d "작업 설명" -w WORKSPACE_ID

# 프로젝트에 작업 생성
bun run dev task create -n "작업 이름" -p PROJECT_ID -w WORKSPACE_ID

# 담당자와 마감일 지정
bun run dev task create -n "작업" -a USER_ID --due 2025-12-31 -w WORKSPACE_ID

# 작업 목록 조회 (내 작업)
bun run dev task list -a me -w WORKSPACE_ID

# 프로젝트의 작업 목록
bun run dev task list -p PROJECT_ID

# 완료된 작업 포함
bun run dev task list -a me -c -w WORKSPACE_ID

# 작업 상세 정보
bun run dev task get TASK_ID

# 작업 완료 처리
bun run dev task complete TASK_ID

# 작업 삭제
bun run dev task delete TASK_ID
```

## 빌드

실행 파일로 컴파일:

```bash
bun run build
```

컴파일된 바이너리 `asana`를 실행:

```bash
./asana auth login --token YOUR_TOKEN
./asana task list -a me
```

## 환경 변수

```bash
# OAuth 인증용 (선택사항)
ASANA_CLIENT_ID=your_client_id
ASANA_CLIENT_SECRET=your_client_secret

# PAT 인증용 (선택사항, --token 대신 사용 가능)
ASANA_ACCESS_TOKEN=your_token

# 기본 workspace (선택사항)
ASANA_WORKSPACE=workspace_id
```

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

# Lint
bun run lint

# Lint 자동 수정
bun run lint:fix
```

## 기술 스택

- **Runtime**: [Bun](https://bun.sh)
- **SDK**: [Asana Node.js SDK](https://github.com/Asana/node-asana)
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **Styling**: [Chalk](https://github.com/chalk/chalk)

## 참고 문서

- [Asana API 문서](https://developers.asana.com/docs)
- [Personal Access Token](https://developers.asana.com/docs/personal-access-token)
- [OAuth 2.0 가이드](https://developers.asana.com/docs/getting-started-with-asana-oauth)
- [인증 개요](https://developers.asana.com/docs/authentication)

## 라이선스

Private

## 작성자

이민수 (Minsu Lee)
- GitHub: [@amondnet](https://github.com/amondnet)
