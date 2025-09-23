#!/bin/bash

# Code Review Script
# Usage: ./scripts/code-review.sh <folder_path> [output_file]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
FOLDER_PATH=""
OUTPUT_FILE=""
TEMP_DIR="/tmp/code-review-$(date +%s)"

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <folder_path> [output_file]"
    echo ""
    echo "Arguments:"
    echo "  folder_path    Path to the folder to review (required)"
    echo "  output_file    Optional output file for the review report"
    echo ""
    echo "Examples:"
    echo "  $0 app/admin/attendance"
    echo "  $0 app/admin/attendance review.md"
    echo "  $0 src/components components-review.md"
}

# Parse arguments
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

FOLDER_PATH="$1"
OUTPUT_FILE="${2:-}"

# Validate folder exists
if [ ! -d "$FOLDER_PATH" ]; then
    print_color $RED "Error: Folder '$FOLDER_PATH' does not exist"
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"

print_color $BLUE "🔍 Starting code review for: $FOLDER_PATH"
print_color $BLUE "📁 Temp directory: $TEMP_DIR"

# Generate analysis files
echo "Analyzing folder structure..."
find "$FOLDER_PATH" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" \) | sort > "$TEMP_DIR/all_files.txt"

echo "Analyzing file types..."
find "$FOLDER_PATH" -type f -name "*.ts" | wc -l > "$TEMP_DIR/ts_count.txt"
find "$FOLDER_PATH" -type f -name "*.tsx" | wc -l > "$TEMP_DIR/tsx_count.txt"
find "$FOLDER_PATH" -type f -name "*.js" | wc -l > "$TEMP_DIR/js_count.txt"
find "$FOLDER_PATH" -type f -name "*.jsx" | wc -l > "$TEMP_DIR/jsx_count.txt"
find "$FOLDER_PATH" -type f -name "*.json" | wc -l > "$TEMP_DIR/json_count.txt"
find "$FOLDER_PATH" -type f -name "*.md" | wc -l > "$TEMP_DIR/md_count.txt"
find "$FOLDER_PATH" -type f -name "*.test.*" | wc -l > "$TEMP_DIR/test_count.txt"

echo "Analyzing imports and exports..."
grep -r "^import\|^export" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null > "$TEMP_DIR/imports_exports.txt" || true

echo "Analyzing TODO/FIXME comments..."
grep -rn "TODO\|FIXME\|XXX\|HACK" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null > "$TEMP_DIR/todos.txt" || true

echo "Analyzing potential issues..."
grep -rn "console\.\|debugger\|alert(" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null > "$TEMP_DIR/debug_statements.txt" || true

echo "Analyzing component patterns..."
grep -rn "^export.*function\|^export.*const.*=\|^function\|^const.*=.*=>" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null > "$TEMP_DIR/functions_components.txt" || true

echo "Analyzing dependencies..."
grep -rn "from.*['\"]" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -E "(from ['\"][^'\"]*['\"])" > "$TEMP_DIR/dependencies.txt" || true

echo "Analyzing hooks usage..."
grep -rn "use[A-Z]" "$FOLDER_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null > "$TEMP_DIR/hooks.txt" || true

echo "Checking for TypeScript errors..."
if command -v npx >/dev/null 2>&1; then
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "$FOLDER_PATH" > "$TEMP_DIR/ts_errors.txt" || true
fi

# Create the review prompt
cat > "$TEMP_DIR/review_prompt.md" << 'EOF'
# Code Review Analysis Request

Please conduct a comprehensive architectural review of the provided folder. Analyze the following aspects:

## 1. Architecture & Structure
- Overall folder organization and patterns
- Component hierarchy and relationships
- Separation of concerns
- Code organization best practices

## 2. Technical Debt & Issues
- Unused/orphaned files and code
- Duplicate functionality
- Inconsistent patterns
- Missing dependencies or broken imports
- Type safety issues
- Performance concerns

## 3. Code Quality
- Import/export consistency
- Naming conventions
- Component patterns (Server vs Client components for Next.js)
- Hook usage and custom hooks
- Error handling patterns

## 4. Dependencies & Imports
- External dependency usage
- Internal import patterns
- Circular dependencies
- Missing or incorrect imports

## 5. Testing & Documentation
- Test coverage and organization
- Documentation quality
- README accuracy
- Code comments and TODOs

## 6. Security & Best Practices
- Debug statements left in code
- Console logs in production code
- Security anti-patterns
- Performance anti-patterns

## Analysis Data Provided:

### File Structure:
```
FOLDER_STRUCTURE_PLACEHOLDER
```

### File Counts:
- TypeScript files: TS_COUNT
- React TypeScript files: TSX_COUNT  
- JavaScript files: JS_COUNT
- React JavaScript files: JSX_COUNT
- JSON files: JSON_COUNT
- Markdown files: MD_COUNT
- Test files: TEST_COUNT

### Key Findings to Investigate:
- Import/Export patterns
- Function/Component definitions
- Hook usage patterns
- TODO/FIXME comments
- Debug statements
- Dependencies analysis
- TypeScript compilation errors

Please provide:
1. **Executive Summary** - High-level overview
2. **Critical Issues** - Must-fix problems
3. **Architectural Assessment** - Design patterns and structure
4. **Technical Debt** - Code quality issues
5. **Recommendations** - Prioritized action items
6. **Code Examples** - Specific problematic code with suggestions

Format the response with clear headings, bullet points, and actionable recommendations.
EOF

# Replace placeholders with actual data
find "$FOLDER_PATH" -type f | head -50 | sed 's|^|  |' > "$TEMP_DIR/folder_structure.txt"
TS_COUNT=$(cat "$TEMP_DIR/ts_count.txt")
TSX_COUNT=$(cat "$TEMP_DIR/tsx_count.txt")
JS_COUNT=$(cat "$TEMP_DIR/js_count.txt")
JSX_COUNT=$(cat "$TEMP_DIR/jsx_count.txt")
JSON_COUNT=$(cat "$TEMP_DIR/json_count.txt")
MD_COUNT=$(cat "$TEMP_DIR/md_count.txt")
TEST_COUNT=$(cat "$TEMP_DIR/test_count.txt")

# Replace folder structure placeholder with file contents
sed -i.bak '/FOLDER_STRUCTURE_PLACEHOLDER/r '"$TEMP_DIR/folder_structure.txt" "$TEMP_DIR/review_prompt.md"
sed -i.bak '/FOLDER_STRUCTURE_PLACEHOLDER/d' "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|TS_COUNT|$TS_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|TSX_COUNT|$TSX_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|JS_COUNT|$JS_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|JSX_COUNT|$JSX_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|JSON_COUNT|$JSON_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|MD_COUNT|$MD_COUNT|g" "$TEMP_DIR/review_prompt.md"
sed -i.bak "s|TEST_COUNT|$TEST_COUNT|g" "$TEMP_DIR/review_prompt.md"

# Create summary of findings
cat > "$TEMP_DIR/analysis_summary.md" << EOF
# Code Analysis Summary for: $FOLDER_PATH

## File Statistics
- Total files analyzed: $(wc -l < "$TEMP_DIR/all_files.txt")
- TypeScript files: $TS_COUNT
- React TypeScript files: $TSX_COUNT
- JavaScript files: $JS_COUNT
- React JavaScript files: $JSX_COUNT
- JSON files: $JSON_COUNT
- Markdown files: $MD_COUNT
- Test files: $TEST_COUNT

## Quick Findings
- TODO/FIXME comments: $(wc -l < "$TEMP_DIR/todos.txt" 2>/dev/null || echo "0")
- Debug statements found: $(wc -l < "$TEMP_DIR/debug_statements.txt" 2>/dev/null || echo "0")
- Unique dependencies: $(cut -d':' -f2- "$TEMP_DIR/dependencies.txt" 2>/dev/null | sort -u | wc -l || echo "0")
- Hook usages: $(wc -l < "$TEMP_DIR/hooks.txt" 2>/dev/null || echo "0")

## Files for Review
$(cat "$TEMP_DIR/all_files.txt")

EOF

# Show progress
print_color $GREEN "✅ Analysis complete!"
print_color $YELLOW "📊 Summary generated at: $TEMP_DIR/analysis_summary.md"
print_color $YELLOW "🤖 Review prompt generated at: $TEMP_DIR/review_prompt.md"

# Display summary
cat "$TEMP_DIR/analysis_summary.md"

# If output file specified, copy the analysis
if [ -n "$OUTPUT_FILE" ]; then
    cp "$TEMP_DIR/analysis_summary.md" "$OUTPUT_FILE"
    print_color $GREEN "📄 Analysis saved to: $OUTPUT_FILE"
fi

print_color $BLUE "🚀 Next steps:"
print_color $BLUE "1. Review the analysis summary above"
print_color $BLUE "2. Use Claude Code with the generated prompt: $TEMP_DIR/review_prompt.md"
print_color $BLUE "3. Or manually review the detailed files in: $TEMP_DIR/"

# Optionally clean up temp directory
read -p "Clean up temporary files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    print_color $GREEN "🧹 Cleaned up temporary files"
else
    print_color $YELLOW "📁 Temporary files preserved at: $TEMP_DIR"
fi