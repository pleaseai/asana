import chalk from 'chalk'
import { Command } from 'commander'
import { execSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const REPO = 'pleaseai/asana'
const BINARY_NAME = 'asana'

interface GitHubRelease {
  tag_name: string
  name: string
  prerelease: boolean
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(): string {
  try {
    // When compiled, we embed version as a constant
    // For development, read from package.json
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
    )
    return packageJson.version
  }
  catch {
    return '0.0.0'
  }
}

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)

  if (!response.ok) {
    throw new Error(`Failed to fetch releases: ${response.statusText}`)
  }

  return await response.json() as GitHubRelease
}

/**
 * Detect current platform and architecture
 */
function detectPlatform(): string {
  const platform = process.platform
  const arch = process.arch

  let os: string
  let archName: string

  switch (platform) {
    case 'darwin':
      os = 'darwin'
      break
    case 'linux':
      os = 'linux'
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }

  switch (arch) {
    case 'x64':
      archName = 'x64'
      break
    case 'arm64':
      archName = 'arm64'
      break
    default:
      throw new Error(`Unsupported architecture: ${arch}`)
  }

  return `${os}-${archName}`
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const fs = await import('node:fs/promises')
  await fs.writeFile(destPath, Buffer.from(buffer))
}

/**
 * Verify checksum
 */
async function verifyChecksum(filePath: string, checksumUrl: string): Promise<boolean> {
  try {
    const response = await fetch(checksumUrl)
    if (!response.ok)
      return false

    const checksumContent = await response.text()
    const expectedChecksum = checksumContent.split(/\s+/)[0]

    // Calculate actual checksum
    const { createHash } = await import('node:crypto')
    const fileBuffer = readFileSync(filePath)
    const actualChecksum = createHash('sha256').update(fileBuffer).digest('hex')

    return expectedChecksum === actualChecksum
  }
  catch {
    return false
  }
}

/**
 * Compare versions (simple semver comparison)
 */
function compareVersions(current: string, latest: string): number {
  const cleanCurrent = current.replace(/^v/, '')
  const cleanLatest = latest.replace(/^v/, '')

  const currentParts = cleanCurrent.split('.').map(Number)
  const latestParts = cleanLatest.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0
    const lat = latestParts[i] || 0

    if (curr < lat)
      return -1
    if (curr > lat)
      return 1
  }

  return 0
}

/**
 * Get current binary path
 */
function getCurrentBinaryPath(): string {
  // Check if running as compiled binary
  if (process.pkg) {
    return process.execPath
  }

  // In development, return a placeholder
  return process.argv[1] || 'asana'
}

/**
 * Check if installed via Homebrew
 */
function isHomebrewInstall(): boolean {
  const binaryPath = getCurrentBinaryPath()
  return binaryPath.includes('/Cellar/') || binaryPath.includes('/opt/homebrew/')
}

/**
 * Perform self-update
 */
async function performUpdate(release: GitHubRelease, currentVersion: string): Promise<void> {
  const platform = detectPlatform()
  const assetName = `${BINARY_NAME}-${platform}`

  // Find the asset for current platform
  const asset = release.assets.find(a => a.name === assetName)
  if (!asset) {
    throw new Error(`No binary found for platform: ${platform}`)
  }

  const checksumAsset = release.assets.find(a => a.name === `${assetName}.sha256`)

  console.log(chalk.blue(`Downloading ${release.tag_name}...`))

  // Create temp directory
  const tempDir = mkdtempSync(join(tmpdir(), 'asana-update-'))
  const tempBinary = join(tempDir, assetName)

  try {
    // Download binary
    await downloadFile(asset.browser_download_url, tempBinary)

    // Verify checksum if available
    if (checksumAsset) {
      console.log(chalk.blue('Verifying checksum...'))
      const isValid = await verifyChecksum(tempBinary, checksumAsset.browser_download_url)

      if (!isValid) {
        throw new Error('Checksum verification failed')
      }

      console.log(chalk.green('✓ Checksum verified'))
    }
    else {
      console.log(chalk.yellow('⚠ No checksum available, skipping verification'))
    }

    // Get current binary path
    const currentBinary = getCurrentBinaryPath()
    const backupBinary = `${currentBinary}.backup`

    // Backup current binary
    if (existsSync(currentBinary)) {
      copyFileSync(currentBinary, backupBinary)
    }

    try {
      // Replace binary
      copyFileSync(tempBinary, currentBinary)
      chmodSync(currentBinary, 0o755)

      // Verify new binary works
      try {
        const newVersion = execSync(`"${currentBinary}" --version`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()

        console.log(chalk.green(`✓ Successfully updated to ${release.tag_name}`))
        console.log(chalk.gray(`  Previous version: v${currentVersion}`))
        console.log(chalk.gray(`  New version: ${newVersion}`))

        // Remove backup
        if (existsSync(backupBinary)) {
          unlinkSync(backupBinary)
        }
      }
      catch (verifyError) {
        // Rollback on verification failure
        console.error(chalk.red('✗ New binary verification failed, rolling back...'))

        if (existsSync(backupBinary)) {
          copyFileSync(backupBinary, currentBinary)
          unlinkSync(backupBinary)
        }

        throw verifyError
      }
    }
    catch (replaceError) {
      // Restore backup if replacement failed
      if (existsSync(backupBinary)) {
        copyFileSync(backupBinary, currentBinary)
        unlinkSync(backupBinary)
      }
      throw replaceError
    }
  }
  finally {
    // Cleanup temp directory
    rmSync(tempDir, { recursive: true, force: true })
  }
}

export function createSelfUpdateCommand(): Command {
  const selfUpdate = new Command('self-update')
    .description('Update Asana CLI to the latest version')
    .option('--check', 'Only check for updates without installing')
    .action(async (options) => {
      try {
        // Check if installed via Homebrew
        if (isHomebrewInstall()) {
          console.log(chalk.yellow('⚠ Detected Homebrew installation'))
          console.log(chalk.blue('Please use Homebrew to update:'))
          console.log(chalk.cyan('  brew upgrade asana-cli'))
          return
        }

        const currentVersion = getCurrentVersion()
        console.log(chalk.blue(`Current version: v${currentVersion}`))

        console.log(chalk.blue('Checking for updates...'))
        const release = await fetchLatestRelease()

        const comparison = compareVersions(currentVersion, release.tag_name)

        if (comparison >= 0) {
          console.log(chalk.green('✓ You are already on the latest version'))
          return
        }

        console.log(chalk.yellow(`New version available: ${release.tag_name}`))

        if (options.check) {
          console.log(chalk.blue('\nTo update, run:'))
          console.log(chalk.cyan('  asana self-update'))
          return
        }

        // Perform update
        await performUpdate(release, currentVersion)
      }
      catch (error) {
        console.error(chalk.red('✗ Update failed:'))
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
      }
    })

  return selfUpdate
}
