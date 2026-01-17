# 🎯 Implement Bulk Actions for Dugsi Admin Dashboard

## 📋 Summary

Implement three bulk actions currently marked as TODOs in the Dugsi admin dashboard to enable admins to efficiently manage multiple families at once:

1. **Send Payment Links** - Generate and provide payment links for selected families
2. **Link Subscriptions** - Bulk link Stripe subscriptions to selected families
3. **Export to CSV** - Export selected families data to CSV file

## 🎯 Goals

- Enable admins to work with multiple families efficiently
- Provide clear feedback on success/failure for bulk operations
- Ensure data consistency and error handling
- Maintain good UX with loading states and progress indicators

## 📍 Current State

### Existing Functionality

- ✅ Single-family subscription linking via `LinkSubscriptionDialog`
- ✅ Payment link generation via `constructDugsiPaymentUrl()` in `lib/stripe-dugsi.ts`
- ✅ Subscription linking action `linkDugsiSubscription()` in `app/admin/dugsi/actions.ts`
- ✅ Family grouping and filtering via hooks (`useFamilyGroups`, `useFamilyFilters`)

### Current TODOs

These bulk actions need to be implemented in the consolidated Dugsi dashboard. The functionality should be added to the Families tab content component or a new bulk actions component.

**Note**: The legacy `dugsi-dashboard.tsx` has been replaced with `consolidated-dugsi-dashboard.tsx`. Bulk actions should be integrated into the consolidated dashboard's Families tab.

## 📝 Detailed Requirements

### 1. Send Payment Links Bulk Action

#### Server Action Requirements

**File**: `app/admin/dugsi/actions.ts`

**Function**: `sendPaymentLinksBulkAction(familyKeys: string[])`

**Input**:

- `familyKeys`: Array of family keys (familyReferenceId || parentEmail || id)

**Process**:

1. For each family key:
   - Find family members using `getFamilyKey` logic
   - Extract: `parentEmail`, `familyReferenceId` (or generate), `childCount`
   - Validate parentEmail exists and is valid
   - Generate payment URL using `constructDugsiPaymentUrl()`:
     ```typescript
     {
       parentEmail: string,
       familyId: string, // familyReferenceId or generated
       childCount: number
     }
     ```
   - Handle errors (missing email, invalid email, etc.)

**Output**:

```typescript
{
  success: boolean,
  data?: Array<{
    familyKey: string,
    parentEmail: string,
    paymentUrl: string,
    childCount: number,
    children: Array<{ id: string, name: string }>
  }>,
  errors?: Array<{
    familyKey: string,
    error: string
  }>
}
```

#### UI Component Requirements

**File**: `app/admin/dugsi/components/send-payment-links-dialog.tsx`

**Features**:

- Display list of generated payment links
- Show family info: parent email, child count, children names
- Copy-to-clipboard button for each link
- "Copy All Links" button
- Success/error indicators per family
- Close button

**UI Flow**:

1. User selects families → clicks "Send Payment Links"
2. Loading state shows "Generating payment links..."
3. Dialog opens with:
   - Successfully generated links (with copy buttons)
   - Failed families (with error messages)
   - Summary: "X links generated, Y failed"
4. Admin can copy individual links or all links
5. Admin can close dialog

**Error Handling**:

- Missing parent email: Show "Parent email required" error
- Invalid email format: Show "Invalid email format" error
- Payment link config missing: Show "Payment link not configured" error
- Network errors: Show retry option

### 2. Link Subscriptions Bulk Action

#### Server Action Requirements

**File**: `app/admin/dugsi/actions.ts`

**Function**: `linkSubscriptionsBulkAction(params: Array<{ familyKey: string, subscriptionId: string }>)`

**Input**:

```typescript
Array<{
  familyKey: string
  subscriptionId: string
}>
```

**Process**:

1. For each family:
   - Get parentEmail from family members
   - Validate subscriptionId format (starts with "sub\_")
   - Call existing `linkDugsiSubscription()` action
   - Track success/failure

**Output**:

```typescript
{
  success: boolean,
  successCount: number,
  errorCount: number,
  results: Array<{
    familyKey: string,
    success: boolean,
    error?: string,
    updatedCount?: number
  }>
}
```

#### UI Component Requirements

**File**: `app/admin/dugsi/components/bulk-link-subscriptions-dialog.tsx`

**Features**:

- List of selected families with:
  - Parent email
  - Child count and names
  - Current subscription status (if any)
- Input options:
  - **Option A**: Single subscription ID for all families (checkbox)
  - **Option B**: Individual subscription ID per family
- Validation before submission:
  - Format check (starts with "sub\_")
  - Optional: Validate subscription exists in Stripe
- Progress indicator during linking
- Results summary:
  - Successfully linked families
  - Failed families with error messages

**UI Flow**:

1. User selects families → clicks "Link Subscriptions"
2. Dialog opens showing selected families
3. Admin chooses:
   - "Use same subscription for all" → single input field
   - OR enter individual subscription IDs → multiple input fields
4. Admin clicks "Validate" (optional but recommended)
5. Admin clicks "Link All"
6. Progress shows for each family
7. Results summary displayed
8. Option to retry failed links

**Error Handling**:

- Missing parent email: Skip with error "Parent email required"
- Invalid subscription ID: Skip with error "Invalid subscription ID format"
- Subscription not found: Skip with error "Subscription not found in Stripe"
- Already linked: Show info "Already linked to subscription X"

### 3. Export to CSV Bulk Action

#### Server Action Requirements

**File**: `app/admin/dugsi/actions.ts`

**Function**: `exportFamiliesToCSVAction(familyKeys: string[])`

**Input**:

- `familyKeys`: Array of family keys

**Process**:

1. For each family key:
   - Get all family members using family grouping logic
   - Extract fields:
     - **Family-level**: familyKey, parentFirstName, parentLastName, parentEmail, parentPhone, parent2FirstName, parent2LastName, parent2Email, parent2Phone
     - **Child-level** (one row per child): name, gender, dateOfBirth, gradeLevel, educationLevel, schoolName, healthInfo, createdAt, paymentMethodCaptured, paymentMethodCapturedAt, stripeCustomerIdDugsi, stripeSubscriptionIdDugsi, subscriptionStatus, paidUntil, currentPeriodStart, currentPeriodEnd
2. Flatten data: One row per child, with family info repeated
3. Format dates consistently
4. Handle null/undefined values

**Output**:

- CSV string ready for download

**CSV Format**:

```csv
Family Key,Parent First Name,Parent Last Name,Parent Email,Parent Phone,Parent 2 First Name,Parent 2 Last Name,Parent 2 Email,Parent 2 Phone,Child Name,Gender,Date of Birth,Grade Level,Education Level,School Name,Health Info,Registration Date,Payment Method Captured,Payment Captured At,Stripe Customer ID,Stripe Subscription ID,Subscription Status,Paid Until,Period Start,Period End
fam_123,John,Doe,john@email.com,123-456-7890,Jane,Doe,jane@email.com,098-765-4321,Child 1,M,2010-01-15,5,ELEMENTARY,ABC School,None,2024-01-01,Yes,2024-01-02,cus_xxx,sub_xxx,active,2024-12-31,2024-01-01,2024-12-31
fam_123,John,Doe,john@email.com,123-456-7890,Jane,Doe,jane@email.com,098-765-4321,Child 2,F,2012-03-20,3,ELEMENTARY,ABC School,Allergies,2024-01-01,Yes,2024-01-02,cus_xxx,sub_xxx,active,2024-12-31,2024-01-01,2024-12-31
```

#### Client Implementation

**File**: `app/admin/dugsi/components/family-table/bulk-actions-bar.tsx` (or new component)

**Handler**: `handleExportToCSV()`

**Process**:

1. Get selected family keys
2. Call server action `exportFamiliesToCSVAction()`
3. Receive CSV string
4. Create blob and trigger download:
   ```typescript
   const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
   const url = URL.createObjectURL(blob)
   const link = document.createElement('a')
   link.href = url
   link.download = `dugsi-families-${new Date().toISOString().split('T')[0]}.csv`
   link.click()
   URL.revokeObjectURL(url)
   ```
5. Show success toast

**Error Handling**:

- Empty selection: Show "Please select families to export"
- Server error: Show error message with retry option

## 📁 Files to Create

### New Files

1. `app/admin/dugsi/components/send-payment-links-dialog.tsx`
   - Client component for displaying payment links
   - Copy-to-clipboard functionality
   - Error display

2. `app/admin/dugsi/components/bulk-link-subscriptions-dialog.tsx`
   - Client component for bulk subscription linking
   - Form with validation
   - Progress indicator
   - Results display

### Modified Files

1. `app/admin/dugsi/actions.ts`
   - Add `sendPaymentLinksBulkAction()`
   - Add `linkSubscriptionsBulkAction()`
   - Add `exportFamiliesToCSVAction()`

2. `app/admin/dugsi/components/family-table/bulk-actions-bar.tsx` (or new bulk actions component)
   - Implement `handleSendPaymentLinks()`
   - Implement `handleBulkLinkSubscriptions()`
   - Implement `handleExportToCSV()`
   - Add state for dialogs
   - Wire up bulk action handlers

3. `app/admin/dugsi/_utils/family.ts` (if needed)
   - Add helper function to get family by key
   - Add helper to extract family data for export

## 🔧 Implementation Steps

### Step 1: Send Payment Links

1. ✅ Create server action `sendPaymentLinksBulkAction()`
2. ✅ Add error handling for missing emails
3. ✅ Create `SendPaymentLinksDialog` component
4. ✅ Add copy-to-clipboard functionality
5. ✅ Wire up in dashboard `handleBulkAction()`
6. ✅ Test with various family configurations
7. ✅ Test error scenarios

### Step 2: Link Subscriptions

1. ✅ Create server action `linkSubscriptionsBulkAction()`
2. ✅ Create `BulkLinkSubscriptionsDialog` component
3. ✅ Add form with single/multiple subscription ID options
4. ✅ Add subscription ID validation
5. ✅ Add progress indicator
6. ✅ Wire up in dashboard `handleBulkAction()`
7. ✅ Test with valid/invalid subscription IDs
8. ✅ Test with families missing parent emails

### Step 3: Export to CSV

1. ✅ Create server action `exportFamiliesToCSVAction()`
2. ✅ Define CSV column structure
3. ✅ Flatten family data to CSV rows
4. ✅ Add export handler in dashboard
5. ✅ Test CSV format and download
6. ✅ Verify all fields included
7. ✅ Test with various data combinations

## ✅ Acceptance Criteria

### Send Payment Links

- [ ] Generates payment links for all selected families with valid parent emails
- [ ] Shows error messages for families missing parent emails
- [ ] Displays payment links in dialog with copy functionality
- [ ] Allows copying individual links or all links at once
- [ ] Shows success/error counts in summary
- [ ] Handles edge cases (invalid email format, missing config)

### Link Subscriptions

- [ ] Allows linking same subscription ID to multiple families
- [ ] Allows linking different subscription IDs to different families
- [ ] Validates subscription ID format before submission
- [ ] Shows progress for each family during linking
- [ ] Displays success/error summary after completion
- [ ] Handles missing parent emails gracefully
- [ ] Handles invalid subscription IDs gracefully
- [ ] Optionally validates subscriptions exist in Stripe before linking

### Export to CSV

- [ ] Exports all selected families to CSV
- [ ] Includes all relevant family and child fields
- [ ] Formats dates consistently
- [ ] Handles null/undefined values appropriately
- [ ] Downloads file with descriptive filename
- [ ] Shows loading state during export
- [ ] Shows success toast after export

## 🧪 Testing Scenarios

### Send Payment Links

- [ ] Test with families that have valid parent emails
- [ ] Test with families missing parent emails
- [ ] Test with invalid email formats
- [ ] Test with large number of families (performance)
- [ ] Test copy-to-clipboard functionality
- [ ] Test error handling when payment link config missing

### Link Subscriptions

- [ ] Test linking same subscription to multiple families
- [ ] Test linking different subscriptions to different families
- [ ] Test with invalid subscription ID format
- [ ] Test with subscription ID that doesn't exist in Stripe
- [ ] Test with families already having subscriptions
- [ ] Test with families missing parent emails
- [ ] Test with large number of families (performance)

### Export to CSV

- [ ] Test export with single family
- [ ] Test export with multiple families
- [ ] Test export with families having multiple children
- [ ] Test export with families missing optional fields
- [ ] Test CSV format is valid (open in Excel/Google Sheets)
- [ ] Test date formatting is correct
- [ ] Test handling of special characters in data

## 🐛 Error Handling

### Common Errors to Handle

1. **Missing Parent Email**
   - Error: "Parent email is required for this family"
   - Action: Skip family, show warning in results

2. **Invalid Email Format**
   - Error: "Invalid email format for [email]"
   - Action: Skip family, show warning in results

3. **Invalid Subscription ID Format**
   - Error: "Subscription ID must start with 'sub\_'"
   - Action: Skip family, show warning in results

4. **Subscription Not Found**
   - Error: "Subscription [id] not found in Stripe"
   - Action: Skip family, show warning in results

5. **Payment Link Not Configured**
   - Error: "Payment link not configured in environment"
   - Action: Show error to admin, don't generate links

6. **Network Errors**
   - Error: "Failed to connect to server"
   - Action: Show retry option

## 📊 Performance Considerations

- **Bulk Operations**: Process in batches if dealing with 100+ families
- **Loading States**: Show progress for long-running operations
- **Error Recovery**: Allow partial success (some families succeed, some fail)
- **Client-Side Export**: Consider client-side CSV generation for better performance

## 🔗 Related Issues/PRs

- Related to: Dugsi Admin Refactoring Plan (Phase 6 completion)
- Blocks: None
- Blocked by: None

## 📚 References

- Payment link generation: `lib/stripe-dugsi.ts::constructDugsiPaymentUrl()`
- Subscription linking: `app/admin/dugsi/actions.ts::linkDugsiSubscription()`
- Family grouping: `app/admin/dugsi/_utils/family.ts`

## 🏷️ Labels

- `enhancement`
- `dugsi-admin`
- `bulk-actions`
