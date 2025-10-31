# Duplicate Students API Endpoint

This API endpoint helps identify potential duplicate student records in the system.

## How to Access

The endpoint is available at:

```
/api/admin/students/duplicates
```

Note that this is an API endpoint, so you need to access it with the full path including `/api/`:

```
http://localhost:3000/api/admin/students/duplicates
```

## Query Parameters

The endpoint supports the following query parameters:

- **`mode`**: Controls which type of duplicates to check for
  - `exact`: Only find exact name matches
  - `similar`: Only find similar names
  - `all`: Find both exact and similar matches (default)

- **`threshold`**: Sets the similarity threshold percentage for similar name matching (default: 80)
  - Higher values (like 90) will only match very similar names
  - Lower values (like 70) will match more loosely similar names

## Examples

1. Get all duplicates (both exact and similar):

   ```
   /api/admin/students/duplicates
   ```

2. Get only exact duplicates:

   ```
   /api/admin/students/duplicates?mode=exact
   ```

3. Get only similar names with a custom threshold:
   ```
   /api/admin/students/duplicates?mode=similar&threshold=75
   ```

## Response Format

The response includes:

1. **`exact`**: Contains groups of students with identical names
   - Each group includes the name, count, and full student details
   - Students are sorted by creation date (oldest first)

2. **`similar`**: Contains groups of students with similar names
   - Each group includes a similarity percentage and student details
   - Groups are sorted by similarity (highest first)

Both sections include summary statistics like total groups and total students.
