// Test environment setup
import * as React from 'react'

// Make React globally available for JSX in test files that don't import it
;(global as typeof global & { React: typeof React }).React = React
