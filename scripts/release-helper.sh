#!/bin/bash
# Release Helper Script for TranslatorSync
# Helps automate the release process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

show_help() {
    echo "Release Helper for TranslatorSync"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  prepare <version>  Prepare a new release"
    echo "  finalize <version> Finalize and create GitHub release"
    echo "  add-change         Add a change to UNRELEASED.md"
    echo "  preview            Preview current unreleased changes"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 prepare 0.2.1"
    echo "  $0 finalize 0.2.1"
    echo "  $0 add-change"
    echo ""
}

check_dependencies() {
    local missing_deps=()
    
    if ! command -v gh &> /dev/null; then
        missing_deps+=("gh (GitHub CLI)")
    fi
    
    if ! command -v jj &> /dev/null; then
        missing_deps+=("jj (Jujutsu)")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi
}

prepare_release() {
    local version=$1
    
    if [ -z "$version" ]; then
        log_error "Version is required for prepare command"
        echo "Usage: $0 prepare <version>"
        exit 1
    fi
    
    log_info "Preparing release v$version"
    
    # Check if version file already exists
    if [ -f "docs/releases/v$version.md" ]; then
        log_warning "Release notes for v$version already exist"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cancelled"
            exit 0
        fi
    fi
    
    # Copy UNRELEASED to version file
    if [ -f "docs/releases/UNRELEASED.md" ]; then
        log_info "Copying unreleased changes to v$version.md"
        
        # Replace placeholders in template
        sed "s/{VERSION}/$version/g; s/{RELEASE_DATE}/$(date '+%B %d, %Y')/g" docs/releases/UNRELEASED.md > docs/releases/v$version.md
        
        log_success "Created docs/releases/v$version.md"
        
        # Clear UNRELEASED.md
        cat > docs/releases/UNRELEASED.md << EOF
# Unreleased Changes

> **Next Version**: v$version (tentative)
> 
> Add your changes here during development. When ready for release, copy content to \`v{VERSION}.md\`

## 🎯 Highlights

- 

## ✨ New Features

- 

## 🐛 Bug Fixes

- 

## 🔧 Improvements

- 

## 🏗️ Development

- 

## 📚 Documentation

- 

## 🔐 Security

- 

## 💔 Breaking Changes

- None

## 📦 Dependencies

- 

## 🙏 Contributors

- 

---

**Instructions**: 
1. Add changes to appropriate sections during development
2. When ready for release, copy content to new \`vX.Y.Z.md\` file
3. Clear this file for next development cycle
EOF
        
        log_success "Reset UNRELEASED.md for next development cycle"
    else
        log_warning "No UNRELEASED.md found, creating empty release notes"
        cp docs/releases/templates/release-template.md docs/releases/v$version.md
    fi
    
    log_info "Next steps:"
    echo "1. Edit docs/releases/v$version.md to finalize release notes"
    echo "2. Update package.json version to $version"
    echo "3. Run: $0 finalize $version"
}

finalize_release() {
    local version=$1
    
    if [ -z "$version" ]; then
        log_error "Version is required for finalize command"
        echo "Usage: $0 finalize <version>"
        exit 1
    fi
    
    log_info "Finalizing release v$version"
    
    # Check if we're on master branch
    local current_branch=$(jj log -r @ --no-graph -T 'branches' 2>/dev/null || echo "unknown")
    if [[ "$current_branch" != *"master"* ]]; then
        log_error "Releases must be created from the 'master' branch"
        echo "Current branch: $current_branch"
        echo ""
        echo "Correct workflow:"
        echo "1. Merge your PR to master first"
        echo "2. jj edit master"
        echo "3. Run: $0 finalize $version"
        exit 1
    fi
    log_info "✅ On master branch, proceeding with release"
    
    # Check if release notes exist
    if [ ! -f "docs/releases/v$version.md" ]; then
        log_error "Release notes not found: docs/releases/v$version.md"
        echo "Run: $0 prepare $version first"
        exit 1
    fi
    
    # Check if package.json version matches
    local package_version=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
    if [ "$package_version" != "$version" ]; then
        log_warning "Package.json version ($package_version) doesn't match release version ($version)"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Update package.json version first"
            exit 0
        fi
    fi
    
    # Run tests and security checks
    log_info "Running pre-release checks..."
    bun run security-check
    bun test tests/unit/
    bun run type-check
    bun run lint
    
    # Create git tag and GitHub release
    log_info "Creating GitHub release..."
    
    # Get release notes content (skip the first line with title)
    local release_notes=$(tail -n +3 docs/releases/v$version.md)
    
    # Create GitHub release
    gh release create "v$version" \
        --title "v$version" \
        --notes "$release_notes" \
        --draft
    
    log_success "Created draft GitHub release for v$version"
    log_info "Review the release at: https://github.com/erik-balfe/translator-sync/releases"
    log_info "When ready, publish the release manually"
}

add_change() {
    log_info "Adding change to UNRELEASED.md"
    
    echo "Select category:"
    echo "1) 🎯 Highlights"
    echo "2) ✨ New Features"
    echo "3) 🐛 Bug Fixes"
    echo "4) 🔧 Improvements"
    echo "5) 🏗️ Development"
    echo "6) 📚 Documentation"
    echo "7) 🔐 Security"
    echo "8) 💔 Breaking Changes"
    echo "9) 📦 Dependencies"
    
    read -p "Enter number (1-9): " -n 1 -r category
    echo
    
    read -p "Enter change description: " description
    
    case $category in
        1) section="## 🎯 Highlights" ;;
        2) section="## ✨ New Features" ;;
        3) section="## 🐛 Bug Fixes" ;;
        4) section="## 🔧 Improvements" ;;
        5) section="## 🏗️ Development" ;;
        6) section="## 📚 Documentation" ;;
        7) section="## 🔐 Security" ;;
        8) section="## 💔 Breaking Changes" ;;
        9) section="## 📦 Dependencies" ;;
        *) log_error "Invalid category"; exit 1 ;;
    esac
    
    # Add to UNRELEASED.md
    sed -i "/$section/a\\- $description" docs/releases/UNRELEASED.md
    
    log_success "Added change to UNRELEASED.md"
}

preview_unreleased() {
    log_info "Current unreleased changes:"
    echo
    if [ -f "docs/releases/UNRELEASED.md" ]; then
        cat docs/releases/UNRELEASED.md
    else
        log_warning "No UNRELEASED.md found"
    fi
}

# Main script
case "$1" in
    "prepare")
        check_dependencies
        prepare_release "$2"
        ;;
    "finalize")
        check_dependencies
        finalize_release "$2"
        ;;
    "add-change")
        add_change
        ;;
    "preview")
        preview_unreleased
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac