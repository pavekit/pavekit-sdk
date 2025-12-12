#!/bin/bash

# PaveKit SDK Documentation Generation Script
# This script generates documentation for the SDK from source code comments

set -e

# Default values
OUTPUT_DIR="./docs"
SOURCE_DIR="./src"
DOC_TYPE="jsdoc"
INCLUDE_PRIVATE=false
FORMAT="html"

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --output=*)
      OUTPUT_DIR="${arg#*=}"
      shift
      ;;
    --source=*)
      SOURCE_DIR="${arg#*=}"
      shift
      ;;
    --type=*)
      DOC_TYPE="${arg#*=}"
      shift
      ;;
    --include-private)
      INCLUDE_PRIVATE=true
      shift
      ;;
    --format=*)
      FORMAT="${arg#*=}"
      shift
      ;;
    --help)
      echo "PaveKit SDK Documentation Generator"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --output=DIR     Output directory (default: ./docs)"
      echo "  --source=DIR     Source directory (default: ./src)"
      echo "  --type=TYPE      Documentation type: jsdoc, typedoc (default: jsdoc)"
      echo "  --format=FORMAT  Output format: html, markdown (default: html)"
      echo "  --include-private Include private members in documentation"
      echo "  --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Ensure we're in the SDK directory
if [[ ! -f "package.json" ]]; then
  echo "Error: package.json not found. Please run this script from the SDK directory."
  exit 1
fi

echo "PaveKit SDK Documentation Generator"
echo "=================================="
echo "Source Directory: $SOURCE_DIR"
echo "Output Directory: $OUTPUT_DIR"
echo "Documentation Type: $DOC_TYPE"
echo "Output Format: $FORMAT"
echo "Include Private: $INCLUDE_PRIVATE"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Generate JSDoc documentation
generate_jsdoc() {
  if ! command_exists jsdoc; then
    echo "Error: jsdoc not found. Please install it with: npm install -g jsdoc"
    exit 1
  fi

  local jsdoc_cmd="jsdoc $SOURCE_DIR"

  # Add output directory
  jsdoc_cmd="$jsdoc_cmd --destination $OUTPUT_DIR"

  # Add private members if requested
  if [ "$INCLUDE_PRIVATE" = true ]; then
    jsdoc_cmd="$jsdoc_cmd --access all"
  else
    jsdoc_cmd="$jsdoc_cmd --access public"
  fi

  # Add package.json as README
  jsdoc_cmd="$jsdoc_cmd --package ./package.json"

  # Add README if it exists
  if [ -f "README.md" ]; then
    jsdoc_cmd="$jsdoc_cmd --readme ./README.md"
  fi

  # Configure template based on format
  case $FORMAT in
    html)
      jsdoc_cmd="$jsdoc_cmd --template node_modules/minami"
      ;;
    markdown)
      jsdoc_cmd="$jsdoc_cmd --template node_modules/jsdoc-to-markdown"
      ;;
    *)
      echo "Unknown format: $FORMAT. Defaulting to HTML."
      jsdoc_cmd="$jsdoc_cmd --template node_modules/minami"
      ;;
  esac

  echo "Generating JSDoc documentation..."
  echo "Command: $jsdoc_cmd"
  echo ""

  eval "$jsdoc_cmd"
}

# Generate TypeDoc documentation
generate_typedoc() {
  if ! command_exists typedoc; then
    echo "Error: typedoc not found. Please install it with: npm install -g typedoc"
    exit 1
  fi

  local typedoc_cmd="typedoc $SOURCE_DIR"

  # Add output directory
  typedoc_cmd="$typedoc_cmd --out $OUTPUT_DIR"

  # Add package.json for name and version
  typedoc_cmd="$typedoc_cmd --package ./package.json"

  # Include private members if requested
  if [ "$INCLUDE_PRIVATE" = true ]; then
    typedoc_cmd="$typedoc_cmd --includePrivate"
  fi

  # Configure theme based on format
  case $FORMAT in
    html)
      typedoc_cmd="$typedoc_cmd --theme default"
      ;;
    markdown)
      typedoc_cmd="$typedoc_cmd --theme markdown"
      ;;
    *)
      echo "Unknown format: $FORMAT. Defaulting to HTML."
      typedoc_cmd="$typedoc_cmd --theme default"
      ;;
  esac

  echo "Generating TypeDoc documentation..."
  echo "Command: $typedoc_cmd"
  echo ""

  eval "$typedoc_cmd"
}

# Main generation logic
case $DOC_TYPE in
  jsdoc)
    generate_jsdoc
    ;;
  typedoc)
    generate_typedoc
    ;;
  *)
    echo "Unknown documentation type: $DOC_TYPE. Supported types: jsdoc, typedoc"
    exit 1
    ;;
esac

# Generate API examples
echo "Generating API examples..."
mkdir -p "$OUTPUT_DIR/examples"

# Create index file with examples
cat > "$OUTPUT_DIR/examples/index.md" << EOF
# PaveKit SDK API Examples

This document contains examples of using the PaveKit SDK.

## Basic Usage

\`\`\`javascript
// Initialize the SDK with your API key
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  detect: true
});

// Start detection
sdk.init();
\`\`\`

## Manual Tracking

\`\`\`javascript
// Track a custom signup event
sdk.track('signup', {
  email: 'user@example.com',
  method: 'custom',
  metadata: {
    plan: 'pro',
    referrer: 'affiliate'
  }
});
\`\`\`

## Privacy Settings

\`\`\`javascript
// Configure privacy options
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  privacy: {
    hashEmails: true,
    respectDNT: false,
    allowedDomains: ['yourdomain.com']
  }
});
\`\`\`

## Event Detection

\`\`\`javascript
// Enable automatic detection
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  detect: true,
  detectForms: true,  // Detect form submissions
  detectOAuth: true   // Detect OAuth callbacks
});
\`\`\`
EOF

# Create configuration reference
cat > "$OUTPUT_DIR/configuration.md" << EOF
# PaveKit SDK Configuration

This document describes all configuration options for the PaveKit SDK.

## Required Options

### apiKey
- Type: \`string\`
- Required: Yes
- Description: Your PaveKit API key.

Example:
\`\`\`javascript
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here'
});
\`\`\`

## Detection Options

### detect
- Type: \`boolean\`
- Default: \`true\`
- Description: Enable automatic signup detection.

### detectForms
- Type: \`boolean\`
- Default: \`true\`
- Description: Detect form submissions.

### detectOAuth
- Type: \`boolean\`
- Default: \`true\`
- Description: Detect OAuth callbacks.

## Privacy Options

### privacy
- Type: \`object\`
- Description: Privacy settings for data handling.

#### privacy.hashEmails
- Type: \`boolean\`
- Default: \`true\`
- Description: Hash emails before sending them to the server.

#### privacy.respectDNT
- Type: \`boolean\`
- Default: \`false\`
- Description: Honor the browser's Do Not Track setting.

#### privacy.allowedDomains
- Type: \`array\`
- Default: \`null\`
- Description: List of domains where the SDK is allowed to run.

## Other Options

### apiUrl
- Type: \`string\`
- Default: \`'https://api.pavekit.com'\`
- Description: Base URL for the PaveKit API.

### debug
- Type: \`boolean\`
- Default: \`false\`
- Description: Enable debug logging to the console.
EOF

echo "Documentation generated successfully!"
echo ""
echo "Generated files:"
echo "  - Main documentation: $OUTPUT_DIR/index.html"
echo "  - API examples: $OUTPUT_DIR/examples/"
echo "  - Configuration guide: $OUTPUT_DIR/configuration.md"
echo ""
echo "To serve the documentation locally:"
echo "  npx serve $OUTPUT_DIR"
echo ""
