# Asana CLI

[![CI](https://github.com/pleaseai/asana/actions/workflows/ci.yml/badge.svg)](https://github.com/pleaseai/asana/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/pleaseai/asana/branch/main/graph/badge.svg)](https://codecov.io/gh/pleaseai/asana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
