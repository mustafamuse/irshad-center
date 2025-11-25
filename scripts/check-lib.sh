#!/bin/bash
# Helper script to check TypeScript errors in lib/ directories

echo "================================"
echo "TypeScript Error Analysis"
echo "================================"
echo ""

echo "📁 Checking lib/queries..."
QUERIES_ERRORS=$(npx tsc --noEmit --project tsconfig.lib-queries.json 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Errors: $QUERIES_ERRORS"
echo ""

echo "📁 Checking lib/services..."
SERVICES_ERRORS=$(npx tsc --noEmit --project tsconfig.lib-services.json 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Errors: $SERVICES_ERRORS"
echo ""

echo "📁 Checking lib/ (all)..."
LIB_ERRORS=$(npx tsc --noEmit --project tsconfig.lib-all.json 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Errors: $LIB_ERRORS"
echo ""

echo "📊 Full codebase..."
TOTAL_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Errors: $TOTAL_ERRORS"
echo ""

echo "================================"
echo "Summary:"
echo "  lib/queries: $QUERIES_ERRORS errors"
echo "  lib/services: $SERVICES_ERRORS errors"
echo "  lib/ total: $LIB_ERRORS errors"
echo "  Full codebase: $TOTAL_ERRORS errors"
echo "================================"
