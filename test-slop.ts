// Test file for slop detection
export function testFunction(value: string) {
  // Set the name to the value
  const name = value

  // Check if name exists
  if (name) {
    // Check if name is truthy
    if (name) {
      return name
    }
  }

  return null
}
