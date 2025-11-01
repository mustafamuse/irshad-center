#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const filePaths = process.argv.slice(2)

if (filePaths.length === 0) {
  process.exit(0)
}

function detectSlop(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  let modified = false
  let cleanedLines = []
  let consecutiveBlankLines = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      consecutiveBlankLines++
      if (consecutiveBlankLines <= 2) {
        cleanedLines.push(line)
      } else {
        modified = true
      }
      continue
    }

    consecutiveBlankLines = 0

    const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')

    if (isComment) {
      const nextLine = lines[i + 1]
      if (nextLine) {
        const nextTrimmed = nextLine.trim()

        const commentText = trimmed
          .replace(/^\/\/\s*/, '')
          .replace(/^\/\*\s*/, '')
          .replace(/^\*\s*/, '')
          .replace(/\*\/$/, '')
          .trim()
          .toLowerCase()

        const codeText = nextTrimmed.toLowerCase()

        if (
          commentText.length > 10 &&
          (codeText.includes(commentText.slice(0, 15)) ||
            commentText.includes(codeText.slice(0, 15)))
        ) {
          modified = true
          continue
        }
      }
    }

    cleanedLines.push(line)
  }

  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
    cleanedLines.pop()
    modified = true
  }

  if (modified) {
    const cleanedContent = cleanedLines.join('\n') + (cleanedLines.length > 0 ? '\n' : '')
    fs.writeFileSync(filePath, cleanedContent, 'utf-8')
  }

  return modified
}

let totalModified = 0

for (const filePath of filePaths) {
  if (fs.existsSync(filePath)) {
    const modified = detectSlop(filePath)
    if (modified) {
      totalModified++
    }
  }
}

process.exit(0)
