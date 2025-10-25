# ADR-001: CLI Distribution Strategy

## Status

Proposed

## Date

2025-10-25

## Context

The Asana CLI tool needs a distribution strategy that meets the following requirements:

1. **Target Users**: Individual developers, primarily macOS users
2. **User Experience**: Easy installation and updates with minimal friction
3. **Auto-update**: Users should be able to easily update to the latest version
4. **Cross-platform**: Support for macOS and Linux (primary and secondary)
5. **Maintainability**: Automated release and distribution process

Currently, the project builds a single binary using `bun build --compile`, but lacks a proper distribution mechanism. Users have to manually download and install the binary from GitHub Releases.

## Decision Drivers

- **Ease of Installation**: One-command installation preferred by developers
- **Discoverability**: Package managers increase tool visibility
- **Update Mechanism**: Automated updates reduce maintenance burden on users
- **Platform Support**: macOS is primary, Linux is secondary
- **CI/CD Integration**: Automated release process reduces manual work

## Considered Options

### Option 1: Homebrew Only

**Pros:**
- Native to macOS ecosystem
- Built-in update mechanism (`brew upgrade`)
- Dependency management handled automatically
- High discoverability among macOS developers

**Cons:**
- macOS/Linux only (no Windows)
- Requires maintaining a separate tap repository
- Learning curve for Formula creation

### Option 2: npm Distribution

**Pros:**
- Wide reach across all platforms
- Familiar to JavaScript/Node.js developers
- Simple to set up (`npm publish`)
- Built-in version management

**Cons:**
- Requires Node.js/npm installation (our binary doesn't need it)
- Larger package size with dependencies
- `npx` experience not ideal for CLI tools
- Conflicts with our compiled binary approach

### Option 3: Installation Script Only

**Pros:**
- Simple `curl | sh` installation
- Full control over installation process
- Cross-platform support
- No external dependencies

**Cons:**
- No built-in update mechanism
- Less discoverable than package managers
- Manual version checking required
- Security concerns with `curl | sh` pattern

### Option 4: Homebrew + Installation Script (Selected)

**Pros:**
- Best of both worlds: convenience (Homebrew) + flexibility (script)
- macOS users get native package manager experience
- Linux users get simple script installation
- Built-in updates via Homebrew
- Manual updates via self-update command
- Automated CI/CD possible for both

**Cons:**
- More maintenance overhead (two distribution channels)
- Need to maintain both Formula and script

## Decision

We will implement **Option 4: Homebrew + Installation Script** with the following components:

### 1. Homebrew Distribution (Primary - macOS)

- Created `pleaseai/homebrew-tap` repository ✅
- Maintain Homebrew Formula (`asana-cli.rb` in tap repo)
- Automate Formula updates via GitHub Actions on release
- Installation: `brew install pleaseai/tap/asana-cli`
- Updates: `brew upgrade asana-cli`

### 2. Installation Script (Secondary - Linux/Manual)

- Provide `scripts/install.sh` for cross-platform installation
- Auto-detect OS and architecture
- Download latest release from GitHub
- Installation: `curl -fsSL https://raw.githubusercontent.com/pleaseai/asana/main/scripts/install.sh | sh`

### 3. Self-Update Command

- Implement `asana self-update` command
- Check GitHub Releases API for latest version
- Download and replace binary automatically
- Fallback when Homebrew is not available

### 4. CI/CD Automation

- GitHub Actions workflow for multi-platform builds
- Automatic release creation with binaries
- Automatic Homebrew Formula update
- Release notes generation

## Implementation Plan

### Phase 1: Core Distribution (Week 1)

1. Create Homebrew Tap repository (`pleaseai/homebrew-tap`)
2. Write initial Homebrew Formula
3. Create installation script (`scripts/install.sh`)
4. Update README with installation instructions

### Phase 2: Automation (Week 2)

1. Create GitHub Actions workflow for releases
2. Multi-platform binary builds (macOS x64/arm64, Linux x64/arm64)
3. Automate Homebrew Formula updates
4. Release notes automation

### Phase 3: Self-Update (Week 3)

1. Implement `asana self-update` command
2. Version checking against GitHub Releases
3. Binary download and replacement logic
4. Permission handling and error recovery

## Consequences

### Positive

- **Better UX**: macOS users get native package manager experience
- **Auto-updates**: Homebrew handles updates automatically
- **Discoverability**: Listed in Homebrew taps increases visibility
- **Flexibility**: Installation script provides alternative for Linux users
- **Automation**: CI/CD reduces manual release work
- **Version Control**: Easy rollback via Homebrew versions

### Negative

- **Maintenance Overhead**: Two distribution channels to maintain
- **Initial Setup**: More complex initial configuration
- **Testing**: Need to test both distribution methods
- **Documentation**: More installation methods to document

### Neutral

- **Windows Support**: Deferred (can add later if needed)
- **npm Distribution**: Not ruled out for future consideration
- **Binary Size**: ~100MB binary distributed through both channels

## References

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Bun Build Documentation](https://bun.sh/docs/bundler/executables)
- [Installation Script Best Practices](https://github.com/Homebrew/install)

## Related Issues

- #TBD: Implement Distribution Strategy

## Notes

- Consider adding Windows support (winget, scoop) if user demand increases
- Monitor download metrics to validate distribution strategy
- Homebrew Formula will use versioned release tarballs
- Installation script should verify checksums for security
