/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  'enforce-component-structure': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Enforce component structure according to our rules',
        category: 'Best Practices',
        recommended: true,
      },
      schema: [],
    },
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (!node.id || !node.id.name.match(/[A-Z]/)) return

          const body = node.body.body
          const hookPattern = /^(use|const.*use)/
          const memoPattern = /^(memo|const.*memo|const.*callback)/
          const handlerPattern = /^handle[A-Z]/

          let lastHookIndex = -1
          let lastMemoIndex = -1
          let lastHandlerIndex = -1

          body.forEach((statement, index) => {
            if (statement.type === 'VariableDeclaration') {
              const name = statement.declarations[0]?.id?.name

              if (name && hookPattern.test(name)) {
                if (lastMemoIndex !== -1 || lastHandlerIndex !== -1) {
                  context.report({
                    node: statement,
                    message:
                      'Hooks should be declared before memos and handlers',
                  })
                }
                lastHookIndex = index
              } else if (name && memoPattern.test(name)) {
                if (lastHandlerIndex !== -1) {
                  context.report({
                    node: statement,
                    message: 'Memos should be declared before handlers',
                  })
                }
                lastMemoIndex = index
              } else if (name && handlerPattern.test(name)) {
                lastHandlerIndex = index
              }
            }
          })
        },
      }
    },
  },

  'enforce-tailwind-classes-order': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Enforce Tailwind classes order according to our rules',
        category: 'Styling',
        recommended: true,
      },
      schema: [],
    },
    create(context) {
      const categoryOrder = [
        'layout',
        'spacing',
        'typography',
        'visual',
        'interactive',
        'responsive',
      ]

      return {
        JSXAttribute(node) {
          if (node.name.name !== 'className') return
          if (node.value.type !== 'Literal') return

          const classes = node.value.value.split(' ')
          const categorizedClasses = {}

          classes.forEach((className) => {
            // Add logic to categorize classes
            // This is a simplified version
            if (className.startsWith('flex') || className.startsWith('grid')) {
              categorizedClasses.layout = categorizedClasses.layout || []
              categorizedClasses.layout.push(className)
            }
            // Add more categories...
          })

          // Check if classes are in correct order
          let lastCategoryIndex = -1
          Object.keys(categorizedClasses).forEach((category) => {
            const currentIndex = categoryOrder.indexOf(category)
            if (currentIndex < lastCategoryIndex) {
              context.report({
                node,
                message: `Tailwind classes should follow order: ${categoryOrder.join(', ')}`,
              })
            }
            lastCategoryIndex = currentIndex
          })
        },
      }
    },
  },

  'enforce-component-documentation': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Enforce component documentation according to our rules',
        category: 'Documentation',
        recommended: true,
      },
      schema: [],
    },
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (!node.id || !node.id.name.match(/[A-Z]/)) return

          const comments = context.getCommentsBefore(node)
          const hasJSDoc = comments.some((comment) =>
            comment.value.includes('@example')
          )

          if (!hasJSDoc) {
            context.report({
              node,
              message:
                'Components should have JSDoc documentation with @example',
            })
          }
        },
      }
    },
  },
}
