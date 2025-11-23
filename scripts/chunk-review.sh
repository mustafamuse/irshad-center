#!/bin/bash
# Chunk-by-chunk code review and fix script

CHUNK_NAME=$1
TSCONFIG_FILE=$2

if [ -z "$CHUNK_NAME" ] || [ -z "$TSCONFIG_FILE" ]; then
    echo "Usage: ./scripts/chunk-review.sh <chunk-name> <tsconfig-file>"
    echo ""
    echo "Examples:"
    echo "  ./scripts/chunk-review.sh 'Mahad Services' tsconfig.mahad-services.json"
    echo "  ./scripts/chunk-review.sh 'Core Queries' tsconfig.lib-queries.json"
    echo ""
    echo "Available configs:"
    ls -1 tsconfig.*.json | grep -v tsconfig.json
    exit 1
fi

echo "========================================"
echo "📋 Chunk Review: $CHUNK_NAME"
echo "========================================"
echo ""

# Step 1: Count errors
echo "🔍 Step 1: Counting TypeScript errors..."
ERROR_COUNT=$(npx tsc --noEmit --project "$TSCONFIG_FILE" 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Found: $ERROR_COUNT errors"
echo ""

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ No errors found! This chunk is clean."
    exit 0
fi

# Step 2: Show error summary
echo "📊 Step 2: Error summary by file..."
npx tsc --noEmit --project "$TSCONFIG_FILE" 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -rn
echo ""

# Step 3: Show detailed errors
echo "📝 Step 3: Detailed errors (first 20)..."
npx tsc --noEmit --project "$TSCONFIG_FILE" 2>&1 | grep "error TS" | head -20
echo ""

# Step 4: Save full report
REPORT_FILE="docs/chunk-reports/${CHUNK_NAME// /-}-$(date +%Y%m%d).txt"
mkdir -p docs/chunk-reports
npx tsc --noEmit --project "$TSCONFIG_FILE" 2>&1 > "$REPORT_FILE"
echo "💾 Full report saved to: $REPORT_FILE"
echo ""

echo "========================================"
echo "Next Steps:"
echo "1. Review the errors above"
echo "2. Fix issues in the affected files"
echo "3. Run this script again to verify"
echo "4. Update CODEBASE_IMPROVEMENT_ROADMAP.md"
echo "========================================"
