#!/bin/bash

# Setup script to install git hooks for PR template automation
# This script copies the pre-push hook to your .git/hooks directory

set -e

echo "🔧 Setting up PR template automation..."
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
  echo "❌ Error: Not in a git repository root directory"
  echo "   Please run this script from the project root"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-push hook
if [ -f .github/hooks/pre-push ]; then
  cp .github/hooks/pre-push .git/hooks/pre-push
  chmod +x .git/hooks/pre-push
  echo "✅ Installed pre-push hook"
else
  echo "❌ Error: .github/hooks/pre-push not found"
  exit 1
fi

# Make the suggestion script executable
if [ -f .github/scripts/suggest-pr-template.js ]; then
  chmod +x .github/scripts/suggest-pr-template.js
  echo "✅ Made PR template suggester executable"
else
  echo "⚠️  Warning: .github/scripts/suggest-pr-template.js not found"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 What happens now:"
echo "  1. When you push a new branch, you'll see a template suggestion"
echo "  2. When you create a PR on GitHub, it will auto-apply the template"
echo "  3. Just fill out the template and you're good to go!"
echo ""
echo "💡 To test the suggester manually:"
echo "   node .github/scripts/suggest-pr-template.js"
echo ""
echo "🌿 Branch naming tips:"
echo "   - feature/your-feature → Feature template"
echo "   - fix/your-bugfix → Bug fix template"
echo "   - hotfix/urgent-fix → Hotfix template"
echo "   - migration/schema-change → Database migration template ⚠️"
echo ""

