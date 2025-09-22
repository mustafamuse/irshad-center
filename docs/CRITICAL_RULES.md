# ⚠️ CRITICAL RULES

## 1. DATABASE SAFETY

🚫 NEVER EVER RESET OR DELETE THE DATABASE

- No destructive migrations
- No data deletion
- Always backup before schema changes
- Only add new fields/tables
- Use soft deletes if needed

## 2. Safe Operations

✅ ALLOWED:

- Adding new tables/columns
- Reading data
- Inserting new records
- Updating existing records with safe changes
- Adding indices
- Adding constraints

❌ NOT ALLOWED:

- Dropping tables
- Removing columns
- Resetting database
- Destructive migrations
- Mass deletions
- Direct database modifications

## 3. Schema Changes

When changing schema:

1. Always use additive changes
2. Keep existing data intact
3. Add new fields as optional
4. Use migrations for changes
5. Test migrations on sample data first

## Remember

"Data is sacred - never delete, only add"
