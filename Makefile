# PaveKit SDK Makefile
# Common tasks for building, testing, and deploying the SDK

.PHONY: help build test clean lint lint-fix docs deploy deploy-patch deploy-minor deploy-major deploy-latest install publish publish-dry-run watch serve

# Default target
help:
	@echo "PaveKit SDK - Common Tasks"
	@echo ""
	@echo "Build & Test:"
	@echo "  build          Build the SDK"
	@echo "  test           Run tests"
	@echo "  test:watch     Run tests in watch mode"
	@echo "  test:e2e       Run end-to-end tests"
	@echo "  clean          Clean build artifacts"
	@echo "  lint           Run linting"
	@echo "  lint-fix       Fix linting issues"
	@echo ""
	@echo "Documentation:"
	@echo "  docs           Generate documentation"
	@echo "  docs:serve     Serve documentation locally"
	@echo ""
	@echo "Deployment:"
	@echo "  deploy         Deploy with patch version increment"
	@echo "  deploy-patch   Deploy with patch version increment"
	@echo "  deploy-minor   Deploy with minor version increment"
	@echo "  deploy-major   Deploy with major version increment"
	@echo "  deploy-latest  Update latest version only"
	@echo "  deploy:dry     Preview deployment commands"
	@echo ""
	@echo "Publishing:"
	@echo "  publish        Publish to NPM"
	@echo "  publish:dry    Preview publishing commands"
	@echo ""
	@echo "Development:"
	@echo "  install        Install dependencies"
	@echo "  watch          Watch for changes and rebuild"
	@echo "  serve          Serve SDK for testing"
	@echo "  size           Check bundle size"

# Installation
install:
	@echo "Installing dependencies..."
	npm install

# Build tasks
build:
	@echo "Building SDK..."
	npm run build

clean:
	@echo "Cleaning build artifacts..."
	npm run clean

# Test tasks
test:
	@echo "Running tests..."
	npm test

test:watch:
	@echo "Running tests in watch mode..."
	npm run test:watch

test:e2e:
	@echo "Running end-to-end tests..."
	npm run test:e2e

# Linting
lint:
	@echo "Running linter..."
	npm run lint

lint-fix:
	@echo "Fixing linting issues..."
	npm run lint:fix

# Documentation
docs:
	@echo "Generating documentation..."
	npm run docs

docs:serve:
	@echo "Serving documentation..."
	@echo "Documentation will be available at http://localhost:3000"
	npx serve docs

# Deployment tasks
deploy:
	@echo "Deploying with patch version increment..."
	./deploy.sh --patch

deploy-patch:
	@echo "Deploying with patch version increment..."
	./deploy.sh --patch

deploy-minor:
	@echo "Deploying with minor version increment..."
	./deploy.sh --minor

deploy-major:
	@echo "Deploying with major version increment..."
	./deploy.sh --major

deploy-latest:
	@echo "Updating latest version only..."
	./deploy.sh --latest-only

deploy:dry:
	@echo "Previewing deployment commands..."
	./deploy.sh --dry-run --patch

# Publishing
publish:
	@echo "Publishing to NPM..."
	npm run npm:publish

publish:dry:
	@echo "Previewing NPM publishing..."
	@echo "Command: npm publish --access public --dry-run"

# Development
watch:
	@echo "Watching for changes and rebuilding..."
	npm run dev

serve:
	@echo "Serving SDK for testing..."
	@echo "Test server will be available at http://localhost:8080"
	npx http-server dist -p 8080 -c-1 --cors

size:
	@echo "Checking bundle size..."
	npm run size

# Quick development cycle
dev: clean build test lint
	@echo "Development build complete"

# Release cycle
release: clean build test lint docs deploy-latest
	@echo "Latest release complete"

# Full release with version bump
release-patch: clean build test lint docs deploy-patch publish
	@echo "Patch release complete"

release-minor: clean build test lint docs deploy-minor publish
	@echo "Minor release complete"

release-major: clean build test lint docs deploy-major publish
	@echo "Major release complete"

# Validate before deployment
validate: clean build test lint size
	@echo "Validation complete"

# Continuous integration target
ci: clean build test lint size
	@echo "CI tasks complete"
