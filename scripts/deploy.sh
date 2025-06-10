#!/bin/bash

# Deployment Helper Script
# Provides easy commands for releasing versions

set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 <command> [version]"
    echo ""
    echo "Commands:"
    echo "  manual <version>    - Trigger manual release workflow"
    echo "  tag <version>       - Create and push tag for automated release"
    echo "  test               - Run deployment tests without releasing"
    echo "  status             - Check deployment status"
    echo "  versions           - Check current versions across registries"
    echo ""
    echo "Examples:"
    echo "  $0 manual 0.2.11"
    echo "  $0 tag 0.2.11"
    echo "  $0 test"
    echo "  $0 status"
    echo "  $0 versions"
}

# Function to validate version format
validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "❌ Invalid version format: $version"
        echo "Expected format: X.Y.Z (e.g., 0.2.11)"
        exit 1
    fi
}

# Function to check if version already exists
check_version_conflicts() {
    local version="$1"
    local conflicts=0
    
    echo "🔍 Checking for version conflicts..."
    
    # Check NPM
    if npm view translator-sync@$version version 2>/dev/null; then
        echo "⚠️  Version $version already exists on NPM"
        conflicts=1
    else
        echo "✅ Version $version is available on NPM"
    fi
    
    # Check JSR
    local jsr_current=$(npx jsr show @tyr/translator-sync 2>/dev/null | grep "latest:" | cut -d' ' -f3 || echo "unknown")
    if [ "$jsr_current" = "$version" ]; then
        echo "⚠️  Version $version already exists on JSR"
        conflicts=1
    else
        echo "✅ Version $version is available on JSR (current: $jsr_current)"
    fi
    
    # Check Git tags
    if git tag -l "v$version" | grep -q "v$version"; then
        echo "⚠️  Git tag v$version already exists"
        conflicts=1
    else
        echo "✅ Git tag v$version is available"
    fi
    
    if [ $conflicts -eq 1 ]; then
        echo ""
        echo "❌ Version conflicts detected. Please choose a different version."
        exit 1
    fi
    
    echo "✅ No version conflicts detected"
}

# Function to run manual release
run_manual_release() {
    local version="$1"
    validate_version "$version"
    check_version_conflicts "$version"
    
    echo ""
    echo "🚀 Triggering manual release for version $version..."
    gh workflow run manual-release.yml -f version="$version" -f branch=master
    
    echo ""
    echo "✅ Manual release workflow triggered!"
    echo "Monitor progress: gh run list"
    echo "View logs: gh run view --log"
}

# Function to create and push tag
create_tag_release() {
    local version="$1"
    validate_version "$version"
    check_version_conflicts "$version"
    
    echo ""
    echo "🏷️ Creating tag for version $version..."
    
    # Check if we're on master
    local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
    if [ "$current_branch" != "master" ]; then
        echo "❌ Must be on master branch to create release tag"
        echo "Current branch: $current_branch"
        echo ""
        echo "To fix:"
        echo "  git checkout master"
        echo "  git pull origin master"
        exit 1
    fi
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Working directory has uncommitted changes"
        echo "Please commit or stash changes before creating a release"
        git status --short
        exit 1
    fi
    
    # Create and push tag
    git tag -a "v$version" -m "Release v$version"
    git push origin "v$version"
    
    echo ""
    echo "✅ Tag v$version created and pushed!"
    echo "Automated release workflow will trigger shortly."
    echo "Monitor progress: gh run list"
}

# Function to check deployment status
check_status() {
    echo "📊 Deployment Status"
    echo "===================="
    echo ""
    
    echo "Recent workflow runs:"
    gh run list --limit 5
    
    echo ""
    echo "Current versions:"
    echo "- Local package.json: $(grep '"version"' package.json | cut -d'"' -f4)"
    echo "- Local deno.json: $(grep '"version"' deno.json | cut -d'"' -f4)"
    echo "- NPM registry: $(npm view translator-sync version 2>/dev/null || echo 'Not found')"
    echo "- JSR registry: $(npx jsr show @tyr/translator-sync 2>/dev/null | grep 'latest:' | cut -d' ' -f3 || echo 'Not found')"
}

# Function to check versions across registries
check_versions() {
    echo "📊 Version Status Across Registries"
    echo "===================================="
    echo ""
    
    # Local versions
    local pkg_version=$(grep '"version"' package.json | cut -d'"' -f4)
    local deno_version=$(grep '"version"' deno.json | cut -d'"' -f4)
    
    echo "Local Versions:"
    echo "- package.json: $pkg_version"
    echo "- deno.json: $deno_version"
    
    if [ "$pkg_version" != "$deno_version" ]; then
        echo "⚠️  Local versions are out of sync!"
    else
        echo "✅ Local versions are in sync"
    fi
    
    echo ""
    echo "Registry Versions:"
    
    # NPM
    local npm_version=$(npm view translator-sync version 2>/dev/null || echo "not-found")
    echo "- NPM: $npm_version"
    
    # JSR
    local jsr_version=$(npx jsr show @tyr/translator-sync 2>/dev/null | grep 'latest:' | cut -d' ' -f3 || echo "not-found")
    echo "- JSR: $jsr_version"
    
    echo ""
    echo "Git Tags:"
    git tag -l "v*" | tail -5 | sort -V
    
    echo ""
    if [ "$pkg_version" = "$npm_version" ] && [ "$pkg_version" = "$jsr_version" ]; then
        echo "✅ All versions are in sync!"
    else
        echo "⚠️  Versions are out of sync. Consider running a release."
    fi
}

# Main script logic
case "${1:-}" in
    manual)
        if [ -z "${2:-}" ]; then
            echo "❌ Version required for manual release"
            echo "Usage: $0 manual <version>"
            exit 1
        fi
        run_manual_release "$2"
        ;;
    tag)
        if [ -z "${2:-}" ]; then
            echo "❌ Version required for tag release"
            echo "Usage: $0 tag <version>"
            exit 1
        fi
        create_tag_release "$2"
        ;;
    test)
        echo "🧪 Running deployment tests..."
        ./scripts/test-release.sh
        ;;
    status)
        check_status
        ;;
    versions)
        check_versions
        ;;
    *)
        show_usage
        exit 1
        ;;
esac