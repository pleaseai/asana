# Environment Setup with dotenvx

This project uses [dotenvx](https://dotenvx.com/) for secure environment variable management with encryption support.

## Quick Setup

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Add your Asana Personal Access Token:**

   Get your PAT from: https://app.asana.com/0/my-apps

   Edit `.env` and add your token:

   ```env
   ASANA_ACCESS_TOKEN=your_actual_token_here
   ASANA_WORKSPACE=your_workspace_gid
   ```

3. **Encrypt your environment file (optional but recommended):**

   ```bash
   bunx dotenvx encrypt
   ```

   This will:
   - Create `.env.vault` (encrypted version - safe to commit)
   - Create `.env.keys` (decryption key - DO NOT commit)
   - The `.env.keys` file is already in `.gitignore`

4. **Run commands with encrypted env:**
   ```bash
   bunx dotenvx run -- bun test
   bunx dotenvx run -- bun dev
   ```

## For Team Members

If the repository has a `.env.vault` file:

1. Ask the team lead for the `DOTENV_KEY`
2. Set it in your environment:
   ```bash
   export DOTENV_KEY="dotenv://:key_xxxxx@dotenvx.com/vault/.env.vault?environment=production"
   ```
3. Run commands:
   ```bash
   bunx dotenvx run -- bun test
   ```

## Testing

For E2E tests, ensure your `.env` file has valid credentials:

```bash
# Run E2E tests
bun test tests/e2e

# Run E2E tests with encrypted env
bunx dotenvx run -- bun test tests/e2e
```

## CI/CD Integration

Set `DOTENV_KEY` as a secret in your CI/CD environment:

```yaml
# GitHub Actions example
- name: Run tests
  env:
    DOTENV_KEY: ${{ secrets.DOTENV_KEY }}
  run: bunx dotenvx run -- bun test
```

## Security Notes

- ✅ `.env.vault` is safe to commit (encrypted)
- ❌ `.env` should NEVER be committed (contains plaintext secrets)
- ❌ `.env.keys` should NEVER be committed (contains decryption keys)
- ✅ Share `DOTENV_KEY` through secure channels only
