# Environment Setup with dotenvx

This project uses [dotenvx](https://dotenvx.com/) for secure environment variable management with public-key encryption support.

## Quick Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Create Your Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 3. Add Your Credentials

Get your Asana Personal Access Token from: https://app.asana.com/0/my-apps

Edit `.env` and add your credentials:

```env
ASANA_ACCESS_TOKEN=your_actual_token_here
ASANA_WORKSPACE=your_workspace_gid
```

### 4. Encrypt Your Secrets (Recommended)

Encrypt your `.env` file using public-key encryption:

```bash
bunx dotenvx encrypt
```

This command will:

- Encrypt all values in your `.env` file using AES-256 with ephemeral keys
- Generate a `DOTENV_PUBLIC_KEY` at the top of your `.env` file (safe to commit)
- Generate a `DOTENV_PRIVATE_KEY` in `.env.keys` file (DO NOT commit)
- The `.env.keys` file is already in `.gitignore`

After encryption, your `.env` file will look like:

```env
#/-------------------[DOTENV_PUBLIC_KEY]--------------------/
#/            public-key encryption for .env files          /
#/       [how it works](https://dotenvx.com/encryption)     /
#/----------------------------------------------------------/
DOTENV_PUBLIC_KEY="0296..."

# encrypted values
ASANA_ACCESS_TOKEN="encrypted:BGK..."
ASANA_WORKSPACE="encrypted:BEH..."
```

### 5. Run Commands with dotenvx

Use `dotenvx run` to automatically decrypt and inject environment variables:

```bash
# Development
bunx dotenvx run -- bun dev

# Testing
bunx dotenvx run -- bun test

# Any command
bunx dotenvx run -- bun src/index.ts
```

## Adding or Updating Encrypted Variables

To set an encrypted value directly:

```bash
bunx dotenvx set VARIABLE_NAME "your_value"
```

This will automatically encrypt the value and update your `.env` file.

## Team Collaboration

### For Team Members Setting Up

1. **Get the encrypted `.env` file** from the repository (already committed)
2. **Request the private key** from your team lead
3. **Add the private key** to your `.env.keys` file:

   ```bash
   # .env.keys
   DOTENV_PRIVATE_KEY="your_private_key_here"
   ```

4. **Run commands** using dotenvx:

   ```bash
   bunx dotenvx run -- bun test
   ```

### For Team Leads Sharing Keys

Share the `DOTENV_PRIVATE_KEY` from your `.env.keys` file through secure channels only:

- 1Password, LastPass, or other password managers
- Encrypted messaging
- In-person or secure video call

**Never commit `.env.keys` to version control!**

## Multiple Environments

Create environment-specific files and use the `-f` flag:

```bash
# Development
bunx dotenvx run -- bun dev

# Production
bunx dotenvx run -f .env.production -- bun start

# Staging
bunx dotenvx run -f .env.staging -- bun start
```

Encrypt each environment file separately:

```bash
bunx dotenvx encrypt -f .env.production
bunx dotenvx encrypt -f .env.staging
```

## CI/CD Integration

### Using Private Key as Environment Variable

In production or CI environments where `.env.keys` is not available, provide the private key as an environment variable:

```bash
DOTENV_PRIVATE_KEY="your_private_key" bunx dotenvx run -- bun test
```

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests
        env:
          DOTENV_PRIVATE_KEY: ${{ secrets.DOTENV_PRIVATE_KEY }}
        run: bunx dotenvx run -- bun test
```

**Setup:**

1. Copy the `DOTENV_PRIVATE_KEY` value from your `.env.keys` file
2. Add it as a repository secret in GitHub: Settings → Secrets → Actions → New repository secret
3. Name it `DOTENV_PRIVATE_KEY`

## Security Best Practices

### ✅ Safe to Commit

- `.env` file (after encryption) - contains encrypted values
- `DOTENV_PUBLIC_KEY` - allows team members to encrypt new secrets

### ❌ Never Commit

- `.env` file (before encryption) - contains plaintext secrets
- `.env.keys` file - contains private decryption keys
- `DOTENV_PRIVATE_KEY` value - must be kept confidential

### 🔐 Secure Sharing

- Share `DOTENV_PRIVATE_KEY` through:
  - Password managers (1Password, LastPass)
  - Encrypted messaging apps
  - CI/CD secrets management
  - In-person or secure channels

## How Encryption Works

dotenvx uses **Elliptic Curve Integrated Encryption Scheme (ECIES)** with:

- **AES-256 encryption** with ephemeral keys for each secret
- **Public key** (DOTENV_PUBLIC_KEY) - encrypts secrets, can be shared
- **Private key** (DOTENV_PRIVATE_KEY) - decrypts secrets, must be confidential

This ensures that even if your encrypted `.env` file is exposed, the secrets remain secure without the private key.

## Troubleshooting

### "Missing .env.keys file" error

- Create `.env.keys` file and add your `DOTENV_PRIVATE_KEY`
- Or set `DOTENV_PRIVATE_KEY` as an environment variable

### "Decryption failed" error

- Verify your `DOTENV_PRIVATE_KEY` matches the key used to encrypt
- Ensure the `.env` file wasn't modified after encryption

### Running without encryption

If you haven't encrypted your `.env` file yet, dotenvx still works:

```bash
bunx dotenvx run -- bun test
```

It will load plaintext values normally until you run `bunx dotenvx encrypt`.
