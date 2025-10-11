# 🗃️ Database Migration

## ⚠️ CRITICAL: Database Changes Require Extra Care

## Migration Description

<!-- Describe what database changes are being made -->

## Related Issue

Fixes #

## Motivation

<!-- Why is this database change needed? -->

## Schema Changes

```prisma
<!-- Paste the FULL schema changes here -->

```

## Migration Strategy

<!-- Explain how the migration will be executed -->

## Safety Checklist ⚠️

- [ ] **VERIFIED**: No data deletion or loss
- [ ] **VERIFIED**: No table drops
- [ ] **VERIFIED**: Changes are additive only
- [ ] **VERIFIED**: New fields are optional (nullable or have defaults)
- [ ] **VERIFIED**: Existing data remains intact
- [ ] **VERIFIED**: Follows rules in `/docs/CRITICAL_RULES.md`
- [ ] Migration tested on local database
- [ ] Migration is reversible (or rollback plan documented)
- [ ] Backup strategy confirmed

## Impact Analysis

### Affected Tables

<!-- List all tables affected by this migration -->

-

### Affected Features

<!-- List features that might be affected -->

-

### Data Volume

<!-- Estimate how much data is affected -->

- Approximately X records in Y table(s)

## Testing

### Test Environment

- [ ] Tested on local database with sample data
- [ ] Tested with production-like data volume
- [ ] Tested migration rollback (if applicable)
- [ ] Verified data integrity after migration

### Test Results

<!-- Describe what you tested and the results -->

## Rollback Plan

<!-- How can this be rolled back if something goes wrong? -->

## Performance Impact

- [ ] Migration runs quickly (< 30 seconds)
- [ ] Migration will take time, but won't block other operations
- [ ] Requires downtime (explain below)

### Performance Notes

<!-- Any performance considerations -->

## Deployment Plan

<!-- Step-by-step deployment plan -->

1.
2.
3.

## Post-Migration Verification

<!-- How will you verify the migration succeeded? -->

- [ ] Check affected table structure
- [ ] Verify data integrity
- [ ] Test affected features
- [ ] Monitor for errors

## Additional Notes

<!-- Any other critical information -->

---

**⚠️ REMINDER: NEVER RESET THE DATABASE. Production data is sacred!**
