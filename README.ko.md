# Asana CLI

[![CI](https://github.com/pleaseai/asana/actions/workflows/ci.yml/badge.svg)](https://github.com/pleaseai/asana/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/pleaseai/asana/branch/main/graph/badge.svg)](https://codecov.io/gh/pleaseai/asana)
[![npm version](https://img.shields.io/npm/v/@pleaseai/asana)](https://www.npmjs.com/package/@pleaseai/asana)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@pleaseai/asana)](https://socket.dev/npm/package/@pleaseai/asana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_asana&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pleaseai_asana)

명령줄에서 Asana 작업을 효율적으로 관리하세요.

> [English](./README.md) | **한국어**

## 주요 기능

- ✅ OAuth 2.0 및 Personal Access Token 인증 지원
- ✅ 작업 생성, 조회, 완료, 삭제
- ✅ 자동 토큰 갱신 (OAuth)
- ✅ 기본 workspace 설정
- ✅ Bun으로 구축된 빠른 실행 속도
- ✨ **다양한 출력 포맷** (TOON, JSON, Plain) 지원으로 다양한 사용 사례 대응

## 빠른 설치

### Homebrew (macOS/Linux - 추천)

```bash
brew install pleaseai/tap/asana-cli
```

### 설치 스크립트 (모든 플랫폼)

```bash
curl -fsSL https://raw.githubusercontent.com/pleaseai/asana/main/scripts/install.sh | bash
```

**참고:** 설치 후 `~/.local/bin`이 PATH에 없다면 추가하세요.

### 소스에서 설치

```bash
git clone https://github.com/pleaseai/asana.git
cd asana
bun install
bun run dev --help
```

## 빠른 시작

### 인증

```bash
# Personal Access Token 사용 (추천)
asana auth login --token YOUR_TOKEN

# OAuth 2.0 사용
asana auth login
```

### 작업 관리

```bash
# 작업 생성
asana task create -n "새로운 작업" -w WORKSPACE_ID

# 내 작업 목록 조회
asana task list -a me -w WORKSPACE_ID

# 작업 완료
asana task complete TASK_ID
```

### 직접 API 호출

`gh api`처럼 임의의 Asana REST 엔드포인트를 직접 호출합니다 — 타입화된 명령이
다루지 않는 엔드포인트를 위한 이스케이프 해치입니다. 응답은 다른 명령과 동일하게
`--format`(TOON/JSON/plain)을 따릅니다.

```bash
# 인증된 사용자 조회
asana api /users/me

# 쿼리 파라미터와 함께 GET (GET/HEAD는 쿼리 문자열로 추가됨)
asana api /tasks/TASK_ID -F opt_fields=name,completed

# 작업 생성 (본문이 있으면 기본 메서드가 POST로 전환됨)
# Asana는 쓰기 본문을 `data` 봉투로 감쌉니다 — --input으로 직접 구성하세요(원시 전달).
echo '{"data":{"name":"새 작업","workspace":"WORKSPACE_ID"}}' \
  | asana api /tasks --input -

# 작업 수정 (PUT/PATCH 본문에도 data 봉투가 필요함)
echo '{"data":{"name":"이름 변경","completed":true}}' \
  | asana api /tasks/TASK_ID -X PUT --input -

# HTTP 상태와 헤더를 출력에 포함
asana api /users/me -i
```

플래그: `-X/--method`(기본 GET, 본문이 있으면 POST), `--raw-field key=value`(문자열),
`-F/--field key=value`(타입 추론 — `true`/`false`/`null`/숫자 파싱),
`--input <file|->`(원시 본문, `data` 봉투 래핑 없음), `-H/--header key:value`, `-i/--include`.
필드(`--raw-field`/`-F`)는 GET/HEAD에서는 쿼리 파라미터로, 그 외에는 평면 JSON 본문이 됩니다.
쓰기 본문은 원시 전달(봉투 자동 래핑 없음)이므로 `--input`으로 보내세요.
전역 `-f`가 `--format`이므로 문자열 필드 플래그는 long 형식 `--raw-field`입니다.

### 출력 포맷

필요에 따라 출력 포맷을 선택하세요:

```bash
# TOON 포맷 (기본값) - LLM을 위한 토큰 효율성 30-60% 향상
asana task list -a me

# JSON 포맷 - 스크립트 및 자동화용
asana task list -a me --format json

# Plain 포맷 - 전통적인 사람이 읽기 편한 출력
asana task list -a me --format plain
```

**포맷 비교:**

| 포맷      | 사용 사례               | 토큰 효율성 | 기계 판독 |
| --------- | ----------------------- | ----------- | --------- |
| **TOON**  | LLM 상호작용, 출력 공유 | ⭐⭐⭐⭐⭐  | ✅        |
| **JSON**  | 스크립트, 자동화, 파싱  | ⭐⭐⭐      | ✅        |
| **Plain** | 터미널 보기, 전통적 CLI | ⭐⭐        | ❌        |

<details>
<summary>📊 출력 예제</summary>

**TOON 포맷** (기본값):

```
tasks[3]{gid,name,completed}:
  "1234567890",인증 설정,true
  "1234567891",작업 명령어 추가,false
  "1234567892",문서 작성,false
```

**JSON 포맷**:

```json
{
  "tasks": [
    { "gid": "1234567890", "name": "인증 설정", "completed": true },
    { "gid": "1234567891", "name": "작업 명령어 추가", "completed": false },
    { "gid": "1234567892", "name": "문서 작성", "completed": false }
  ]
}
```

**Plain 포맷**:

```
Tasks (3):

✓ 1234567890 - 인증 설정
○ 1234567891 - 작업 명령어 추가
○ 1234567892 - 문서 작성
```

</details>

## 문서

**[📖 전체 문서](https://asana.pleaseai.dev/ko)**

- [시작하기](https://asana.pleaseai.dev/ko/guide/getting-started) - 설치 및 설정
- [빠른 시작](https://asana.pleaseai.dev/ko/guide/quick-start) - 기본 명령어와 워크플로우
- [인증](https://asana.pleaseai.dev/ko/features/authentication) - OAuth 및 PAT 설정
- [작업 관리](https://asana.pleaseai.dev/ko/features/task-management) - 전체 작업 관리 기능
- [설정](https://asana.pleaseai.dev/ko/features/configuration) - 고급 설정

## 업데이트

### Homebrew

```bash
brew upgrade asana-cli
```

### 설치 스크립트

```bash
asana self-update
```

## 개발

```bash
# 클론 및 설치
git clone https://github.com/pleaseai/asana.git
cd asana
bun install

# 개발 모드로 실행
bun run dev auth login --token YOUR_TOKEN

# 테스트 실행
bun test

# 실행 파일 빌드
bun run build
```

자세한 개발 가이드는 [dev-docs/](./dev-docs/)를 참고하세요.

## 기술 스택

- **Runtime**: [Bun](https://bun.sh)
- **SDK**: [Asana Node.js SDK](https://github.com/Asana/node-asana)
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **출력 포맷**: [TOON](https://github.com/johannschopplich/toon) - LLM을 위한 토큰 효율적 포맷
- **Styling**: [Chalk](https://github.com/chalk/chalk)

## 라이선스

MIT

## 작성자

이민수 (Minsu Lee) ([@amondnet](https://github.com/amondnet))
