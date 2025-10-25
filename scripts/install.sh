#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# GitHub repository
REPO="pleaseai/asana"
BINARY_NAME="asana"

# Detect OS and architecture
detect_platform() {
    local OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    local ARCH=$(uname -m)

    case "$OS" in
        darwin)
            OS="darwin"
            ;;
        linux)
            OS="linux"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $OS${NC}"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64 | amd64)
            ARCH="x64"
            ;;
        arm64 | aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac

    echo "${OS}-${ARCH}"
}

# Get latest release version
get_latest_version() {
    curl -s "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"([^"]+)".*/\1/'
}

# Download and install
install_asana() {
    local PLATFORM=$(detect_platform)
    local VERSION=$(get_latest_version)

    if [ -z "$VERSION" ]; then
        echo -e "${RED}Error: Could not determine latest version${NC}"
        exit 1
    fi

    echo -e "${GREEN}Installing Asana CLI ${VERSION} for ${PLATFORM}...${NC}"

    local DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${PLATFORM}"
    local CHECKSUM_URL="${DOWNLOAD_URL}.sha256"
    local INSTALL_DIR="${HOME}/.local/bin"
    local TEMP_DIR=$(mktemp -d)

    # Create install directory if it doesn't exist
    mkdir -p "$INSTALL_DIR"

    # Download binary
    echo "Downloading ${BINARY_NAME}..."
    if ! curl -L --progress-bar -o "${TEMP_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL"; then
        echo -e "${RED}Error: Failed to download binary${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Download checksum
    echo "Downloading checksum..."
    if ! curl -L -s -o "${TEMP_DIR}/${BINARY_NAME}.sha256" "$CHECKSUM_URL"; then
        echo -e "${YELLOW}Warning: Could not download checksum, skipping verification${NC}"
    else
        # Verify checksum
        echo "Verifying checksum..."
        cd "$TEMP_DIR"
        if command -v shasum &> /dev/null; then
            shasum -a 256 -c "${BINARY_NAME}.sha256" || {
                echo -e "${RED}Error: Checksum verification failed${NC}"
                rm -rf "$TEMP_DIR"
                exit 1
            }
        elif command -v sha256sum &> /dev/null; then
            sha256sum -c "${BINARY_NAME}.sha256" || {
                echo -e "${RED}Error: Checksum verification failed${NC}"
                rm -rf "$TEMP_DIR"
                exit 1
            }
        else
            echo -e "${YELLOW}Warning: No checksum utility found, skipping verification${NC}"
        fi
        cd - > /dev/null
    fi

    # Install binary
    echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
    mv "${TEMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

    # Cleanup
    rm -rf "$TEMP_DIR"

    echo -e "${GREEN}✓ Asana CLI installed successfully!${NC}"
    echo ""
    echo "Installation location: ${INSTALL_DIR}/${BINARY_NAME}"
    echo ""

    # Check if install directory is in PATH
    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        echo -e "${YELLOW}Warning: ${INSTALL_DIR} is not in your PATH${NC}"
        echo ""
        echo "Add the following line to your shell configuration file:"
        echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
        echo ""
        echo "For bash, add to ~/.bashrc or ~/.bash_profile"
        echo "For zsh, add to ~/.zshrc"
        echo ""
    fi

    # Test installation
    if command -v asana &> /dev/null; then
        echo "Run 'asana --help' to get started!"
    else
        echo "Run '${INSTALL_DIR}/asana --help' to get started!"
    fi
}

# Main
main() {
    echo -e "${GREEN}Asana CLI Installer${NC}"
    echo ""

    # Check for required commands
    for cmd in curl uname; do
        if ! command -v "$cmd" &> /dev/null; then
            echo -e "${RED}Error: Required command '$cmd' not found${NC}"
            exit 1
        fi
    done

    install_asana
}

main "$@"
