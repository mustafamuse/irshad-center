#!/bin/bash
# Quick check of all chunks

echo "================================"
echo "Chunk Status Overview"
echo "================================"
echo ""

check_chunk() {
    local name=$1
    local config=$2

    if [ ! -f "$config" ]; then
        echo "⚪ $name: Config not found"
        return
    fi

    local errors=$(npx tsc --noEmit --project "$config" 2>&1 | grep "error TS" | wc -l | tr -d ' ')

    if [ "$errors" -eq 0 ]; then
        echo "✅ $name: 0 errors"
    elif [ "$errors" -lt 5 ]; then
        echo "🟡 $name: $errors errors"
    else
        echo "🔴 $name: $errors errors"
    fi
}

check_chunk "Queries Layer       " "tsconfig.lib-queries.json"
check_chunk "Services Layer      " "tsconfig.lib-services.json"
check_chunk "Mahad Services      " "tsconfig.mahad-services.json"
check_chunk "All lib/            " "tsconfig.lib-all.json"

echo ""
echo "Full codebase:"
TOTAL=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l | tr -d ' ')
echo "   Total errors: $TOTAL"
echo ""
echo "================================"
