# GitHub Actions Workflows

이 디렉토리에는 프로젝트의 CI/CD 워크플로우가 포함되어 있습니다.

## Workflows

### 1. CI (`ci.yml`)

**트리거**: Push 및 Pull Request (main 브랜치)

자동으로 실행되는 continuous integration 워크플로우:

- Unit 테스트 실행
- 코드 커버리지 생성 및 Codecov 업로드
- 빌드 검증
- ESLint 검사

### 2. E2E Tests (`e2e-tests.yml`)

**트리거**: Manual (workflow_dispatch)

수동으로 실행하는 E2E 테스트 워크플로우입니다.

#### 필요한 Secrets

GitHub Repository Settings > Secrets and variables > Actions에서 다음 secrets를 설정해야 합니다:

- `ASANA_ACCESS_TOKEN` (필수) - Asana Personal Access Token
- `ASANA_WORKSPACE` (필수) - Asana Workspace GID

#### 실행 방법

1. GitHub 저장소로 이동
2. **Actions** 탭 클릭
3. 왼쪽에서 **"E2E Tests (Manual)"** 선택
4. **"Run workflow"** 버튼 클릭
5. (선택) `workspace_gid` 입력 - 다른 workspace에서 테스트하고 싶은 경우
6. **"Run workflow"** 버튼 클릭하여 실행

#### 입력 파라미터

- `workspace_gid` (optional): 특정 workspace에서 테스트를 실행하려면 입력. 비워두면 `ASANA_WORKSPACE` secret 사용.

### 3. E2E Tests with dotenvx (`e2e-tests-secure.yml`)

**트리거**: Manual (workflow_dispatch)

dotenvx를 사용하여 암호화된 환경 변수로 E2E 테스트를 실행합니다.

#### 필요한 설정

1. **로컬에서 .env 파일 암호화:**

   ```bash
   bun run env:encrypt
   ```

   이렇게 하면 `.env.vault` 파일과 `.env.keys` 파일이 생성됩니다.

2. **`.env.vault` 파일 커밋:**

   ```bash
   git add .env.vault
   git commit -m "chore: add encrypted environment vault"
   git push
   ```

3. **DOTENV_KEY Secret 설정:**
   - `.env.keys` 파일에서 `DOTENV_PRIVATE_KEY` 값 복사
   - GitHub Repository Settings > Secrets > New repository secret
   - Name: `DOTENV_KEY`
   - Value: `dotenv://:key_YOUR_KEY_HERE@dotenvx.com/vault/.env.vault?environment=production`

#### 실행 방법

1. GitHub 저장소로 이동
2. **Actions** 탭 클릭
3. 왼쪽에서 **"E2E Tests with dotenvx (Manual)"** 선택
4. **"Run workflow"** 버튼 클릭
5. (선택) `dotenv_key` 입력 - 임시로 다른 키를 사용하고 싶은 경우
6. **"Run workflow"** 버튼 클릭하여 실행

#### 장점

- ✅ `.env.vault`는 커밋해도 안전 (암호화됨)
- ✅ 팀원들과 안전하게 환경 변수 공유
- ✅ 여러 환경(dev, staging, production) 지원
- ✅ 키 로테이션 지원

### 4. Release Please (`release-please.yml`)

**트리거**: Push (main 브랜치)

Conventional Commits를 사용하여 자동으로 릴리스를 생성합니다.

## 로컬에서 워크플로우 테스트

[act](https://github.com/nektos/act)를 사용하여 로컬에서 워크플로우를 테스트할 수 있습니다:

```bash
# CI 워크플로우 테스트
act -j test

# E2E 워크플로우 테스트 (secrets 필요)
act workflow_dispatch -j e2e-tests -s ASANA_ACCESS_TOKEN=your_token -s ASANA_WORKSPACE=your_workspace
```

## 트러블슈팅

### E2E 테스트 실패

1. **인증 오류:**
   - `ASANA_ACCESS_TOKEN` secret이 올바른지 확인
   - Token이 만료되지 않았는지 확인
   - Token이 해당 workspace에 대한 권한이 있는지 확인

2. **Workspace 오류:**
   - `ASANA_WORKSPACE` GID가 올바른지 확인
   - Workspace에 테스트 task를 생성/삭제할 권한이 있는지 확인

3. **dotenvx 오류:**
   - `.env.vault` 파일이 커밋되었는지 확인
   - `DOTENV_KEY`가 올바른 형식인지 확인
   - 키가 `.env.vault`와 매칭되는지 확인

### 도움말

더 자세한 정보는 다음 문서를 참조하세요:

- [E2E Test Guide](../../tests/e2e/README.md)
- [Environment Setup](../../dev-docs/ENVIRONMENT_SETUP.md)
