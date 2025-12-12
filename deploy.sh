#!/bin/bash

# PaveKit SDK Deployment Script
# Usage: ./deploy.sh [version] [options]
# Examples:
#   ./deploy.sh 1.0.0                # Deploy specific version
#   ./deploy.sh --patch              # Auto-increment patch version
#   ./deploy.sh --minor              # Auto-increment minor version
#   ./deploy.sh --major              # Auto-increment major version
#   ./deploy.sh --latest-only        # Update only latest version (no new version number)

set -e

# Default values
BUCKET_NAME="${CLOUDFLARE_R2_BUCKET:-pavekit-sdk}"
BUILD_DIR="./dist"
SDK_FILE="pavekit.min.js"
VERSION_FILE="./package.json"
LATEST_ONLY=false
RELEASE_TYPE=""
DRY_RUN=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --latest-only)
      LATEST_ONLY=true
      shift
      ;;
    --patch)
      RELEASE_TYPE="patch"
      shift
      ;;
    --minor)
      RELEASE_TYPE="minor"
      shift
      ;;
    --major)
      RELEASE_TYPE="major"
      shift
      ;;
    *)
      if [[ $arg =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        VERSION=$arg
        shift
      fi
      ;;
  esac
done

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check dependencies
if ! command_exists wrangler; then
  echo "Error: wrangler CLI not found. Please install it with: npm install -g wrangler"
  exit 1
fi

if ! command_exists jq; then
  echo "Error: jq not found. Please install it to handle JSON manipulation."
  exit 1
fi

# Ensure we're in the SDK directory
if [[ ! -f "$VERSION_FILE" ]]; then
  echo "Error: $VERSION_FILE not found. Please run this script from the SDK directory."
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./$VERSION_FILE').version")

# Determine new version
if [[ "$LATEST_ONLY" == "false" ]]; then
  if [[ -n "$VERSION" ]]; then
    NEW_VERSION=$VERSION
  elif [[ -n "$RELEASE_TYPE" ]]; then
    # Auto-increment version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"

    case $RELEASE_TYPE in
      major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
      minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
      patch)
        PATCH=$((PATCH + 1))
        ;;
    esac

    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
  else
    # Default to patch if no version specified
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
  fi
else
  NEW_VERSION=$CURRENT_VERSION
fi

# Check if version is newer than current (unless latest-only)
if [[ "$LATEST_ONLY" == "false" ]]; then
  if ! node -e "require('semver').gt('$NEW_VERSION', '$CURRENT_VERSION')" 2>/dev/null; then
    echo "Warning: New version $NEW_VERSION is not greater than current version $CURRENT_VERSION"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

echo "PaveKit SDK Deployment"
echo "======================"
echo "Current Version: $CURRENT_VERSION"
if [[ "$LATEST_ONLY" == "false" ]]; then
  echo "New Version: $NEW_VERSION"
fi
echo "Bucket: $BUCKET_NAME"
echo ""

# Build the SDK if needed
if [[ ! -f "$BUILD_DIR/$SDK_FILE" ]] || [[ "$LATEST_ONLY" == "false" ]]; then
  echo "Building SDK..."
  npm run build
  echo "Build complete."
  echo ""
fi

# Check if the build file exists
if [[ ! -f "$BUILD_DIR/$SDK_FILE" ]]; then
  echo "Error: Built SDK file not found at $BUILD_DIR/$SDK_FILE"
  exit 1
fi

# Get file size for reporting
FILE_SIZE=$(stat -c%s "$BUILD_DIR/$SDK_FILE" 2>/dev/null || stat -f%z "$BUILD_DIR/$SDK_FILE" 2>/dev/null)
echo "SDK file size: $(($FILE_SIZE / 1024))KB"

# Prepare deployment commands
DEPLOY_COMMANDS=()

# Add versioned upload if not latest-only
if [[ "$LATEST_ONLY" == "false" ]]; then
  DEPLOY_COMMANDS+=("wrangler r2 object put $BUCKET_NAME/v$NEW_VERSION/pavekit-sdk.min.js --file=$BUILD_DIR/$SDK_FILE")
fi

# Always upload as latest
DEPLOY_COMMANDS+=("wrangler r2 object put $BUCKET_NAME/latest/pavekit-sdk.min.js --file=$BUILD_DIR/$SDK_FILE")

# Add semantic version aliases if not latest-only
if [[ "$LATEST_ONLY" == "false" ]]; then
  MAJOR_VERSION=$(echo $NEW_VERSION | cut -d. -f1)
  MINOR_VERSION=$(echo $NEW_VERSION | cut -d. -f1-2)

  DEPLOY_COMMANDS+=("wrangler r2 object put $BUCKET_NAME/v$MAJOR_VERSION/pavekit-sdk.min.js --file=$BUILD_DIR/$SDK_FILE")
  DEPLOY_COMMANDS+=("wrangler r2 object put $BUCKET_NAME/v$MINOR_VERSION/pavekit-sdk.min.js --file=$BUILD_DIR/$SDK_FILE")
fi

# Show deployment plan
echo "Deployment Plan:"
for cmd in "${DEPLOY_COMMANDS[@]}"; do
  echo "  $cmd"
done

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY RUN: No files will be uploaded."
  echo ""
  exit 0
fi

# Ask for confirmation
read -p "Proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 1
fi

# Execute deployment
echo "Starting deployment..."
for cmd in "${DEPLOY_COMMANDS[@]}"; do
  echo "Executing: $cmd"
  eval "$cmd"
done

# Update versions.json
echo "Updating versions.json..."

# Get existing versions or create new
echo "Fetching existing versions..."
wrangler r2 object get $BUCKET_NAME/versions.json > existing-versions.json 2>/dev/null || echo '{}' > existing-versions.json

# Update with new version
echo "Updating version metadata..."
if [[ "$LATEST_ONLY" == "false" ]]; then
  jq --arg version "$NEW_VERSION" '.versions += [$version] | .versions |= unique | .latest = $version' existing-versions.json > new-versions.json
else
  jq '.latest = "'$CURRENT_VERSION'"' existing-versions.json > new-versions.json
fi

# Upload updated versions file
echo "Uploading versions.json..."
wrangler r2 object put $BUCKET_NAME/versions.json --file=new-versions.json

# Clean up temp files
rm -f existing-versions.json new-versions.json

# Update package.json if version changed
if [[ "$LATEST_ONLY" == "false" ]]; then
  echo "Updating package.json to version $NEW_VERSION..."
  npm version $NEW_VERSION --no-git-tag-version

  echo ""
  echo "Remember to commit the version change:"
  echo "  git add package.json"
  echo "  git commit -m \"chore: bump SDK version to $NEW_VERSION\""
  echo "  git tag v$NEW_VERSION"
  echo "  git push origin main --tags"
fi

echo ""
echo "Deployment complete!"
echo ""

# Show CDN URLs
echo "CDN URLs:"
if [[ "$LATEST_ONLY" == "false" ]]; then
  echo "  Latest: https://cdn.pavekit.com/latest/pavekit-sdk.min.js"
  echo "  Version $NEW_VERSION: https://cdn.pavekit.com/v$NEW_VERSION/pavekit-sdk.min.js"
  echo "  Major version (v$MAJOR_VERSION): https://cdn.pavekit.com/v$MAJOR_VERSION/pavekit-sdk.min.js"
  echo "  Minor version (v$MINOR_VERSION): https://cdn.pavekit.com/v$MINOR_VERSION/pavekit-sdk.min.js"
else
  echo "  Latest: https://cdn.pavekit.com/latest/pavekit-sdk.min.js"
fi
echo ""

# Show npm publish instructions if version changed
if [[ "$LATEST_ONLY" == "false" ]]; then
  echo "To publish to NPM:"
  echo "  npm run build:types"
  echo "  npm publish --access public"
  echo ""
fi

# Show test instructions
echo "To test the new SDK:"
echo "  1. Add the script to your test page:"
echo "     <script src=\"https://cdn.pavekit.com/latest/pavekit-sdk.min.js\"></script>"
echo "  2. Open browser console and verify:"
echo "     console.log(window.PaveKitSDK)"
echo ""
