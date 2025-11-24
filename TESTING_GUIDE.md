# Testing Guide: Registration Improvements

This guide helps you test the three improvements we made to the Mahad registration system.

## 🚀 Quick Start

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Navigate to the registration page:**
   - Open: `http://localhost:3000/mahad/register`
   - Or: `http://localhost:3000/mahad/register` (if using custom port)

3. **Have your database ready:**
   - Make sure your database is running
   - You'll need to create test registrations to test duplicate detection

---

## 📋 Test Scenarios

### Test 1: Duplicate Email Only (Single Field Error)

**Purpose:** Verify that when only email is duplicate, error shows on email field only.

**Steps:**

1. Register a student with:
   - Email: `test@example.com`
   - Phone: `555-123-4567`
   - Fill in all other required fields
   - Submit the form

2. Try to register again with:
   - Email: `test@example.com` (same email)
   - Phone: `555-999-8888` (different phone)
   - Fill in all other required fields
   - Submit the form

**Expected Result:**

- ✅ Error message appears under the **email field only**
- ✅ Error message: "This email address is already registered for the **Mahad** program"
- ✅ Notice the capitalized "Mahad" (not "mahad")
- ✅ Phone field shows no error

**What to Check:**

- [ ] Error appears only on email field
- [ ] Error message is capitalized correctly ("Mahad program")
- [ ] Toast notification says "Please check the form for errors"

---

### Test 2: Duplicate Phone Only (Single Field Error)

**Purpose:** Verify that when only phone is duplicate, error shows on phone field only.

**Steps:**

1. Register a student with:
   - Email: `student1@example.com`
   - Phone: `555-123-4567`
   - Fill in all other required fields
   - Submit the form

2. Try to register again with:
   - Email: `student2@example.com` (different email)
   - Phone: `555-123-4567` (same phone)
   - Fill in all other required fields
   - Submit the form

**Expected Result:**

- ✅ Error message appears under the **phone field only**
- ✅ Error message: "This phone number is already registered for the **Mahad** program"
- ✅ Notice the capitalized "Mahad"
- ✅ Email field shows no error

**What to Check:**

- [ ] Error appears only on phone field
- [ ] Error message is capitalized correctly
- [ ] This was the original bug - phone errors were showing on email field before!

---

### Test 3: Duplicate Both Email AND Phone (Both Fields Error) ⭐ NEW FEATURE

**Purpose:** Verify that when both email and phone are duplicates, errors show on BOTH fields.

**Steps:**

1. Register a student with:
   - Email: `duplicate@example.com`
   - Phone: `555-123-4567`
   - Fill in all other required fields
   - Submit the form

2. Try to register again with:
   - Email: `duplicate@example.com` (same email)
   - Phone: `555-123-4567` (same phone)
   - Fill in all other required fields
   - Submit the form

**Expected Result:**

- ✅ Error message appears under **BOTH email AND phone fields**
- ✅ Error message: "This email address and phone number are already registered for the **Mahad** program"
- ✅ Both fields are highlighted with error styling
- ✅ Toast notification says "Please check the form for errors"

**What to Check:**

- [ ] Error appears on BOTH email and phone fields (this is the new behavior!)
- [ ] Error message mentions both fields
- [ ] Error message is capitalized correctly
- [ ] Both fields have red border/error styling

---

### Test 4: Error Message Capitalization

**Purpose:** Verify that program names are properly capitalized in error messages.

**Steps:**

1. Trigger any duplicate error (use Test 1, 2, or 3 above)

**Expected Result:**

- ✅ Error message shows: "**Mahad** program" (capitalized)
- ❌ NOT: "mahad program" (lowercase - this was the old behavior)

**What to Check:**

- [ ] Program name is capitalized: "Mahad program"
- [ ] Not lowercase: "mahad program"

---

### Test 5: areSiblings Optimization (Backend)

**Purpose:** Verify that the optimized `areSiblings` query still works correctly.

**Note:** This is a backend optimization, so it's harder to test directly in the UI. However, you can verify it works by:

**Steps:**

1. Register two students as siblings (if you have that feature)
2. Check that sibling relationships are created correctly
3. Verify no errors occur

**Expected Result:**

- ✅ Sibling relationships work correctly
- ✅ No database errors
- ✅ Performance is slightly better (not noticeable in UI, but query is simpler)

**What to Check:**

- [ ] Sibling relationships can be created
- [ ] No console errors
- [ ] No database constraint violations

---

## 🎯 Quick Test Checklist

Use this checklist to quickly verify all improvements:

- [ ] **Test 1:** Duplicate email only → Error on email field only ✅
- [ ] **Test 2:** Duplicate phone only → Error on phone field only ✅ (was buggy before!)
- [ ] **Test 3:** Duplicate both → Error on BOTH fields ✅ (NEW!)
- [ ] **Test 4:** Error messages show "Mahad program" (capitalized) ✅
- [ ] **Test 5:** No console errors, everything works ✅

---

## 🔍 What Changed - Summary

### Before:

- ❌ Phone duplicate errors showed on email field (BUG)
- ❌ "both" duplicate errors only showed on email field
- ❌ Error messages showed "mahad program" (lowercase)

### After:

- ✅ Phone duplicate errors show on phone field (FIXED)
- ✅ "both" duplicate errors show on BOTH fields (IMPROVED)
- ✅ Error messages show "Mahad program" (capitalized) (FIXED)
- ✅ `areSiblings` query optimized (performance improvement)

---

## 🐛 Troubleshooting

### Issue: Can't see the registration form

- **Solution:** Make sure dev server is running: `npm run dev`
- Check the URL: `http://localhost:3000/mahad/register`

### Issue: No duplicate errors appearing

- **Solution:** Make sure you're using the exact same email/phone that was registered before
- Check browser console for errors
- Verify database connection

### Issue: Errors showing in wrong fields

- **Solution:** Clear browser cache and refresh
- Check that you've restarted the dev server after code changes

### Issue: Error messages still showing lowercase

- **Solution:** Make sure you've restarted the dev server
- Check that `lib/types/registration-errors.ts` has the `formatProgramName` function

---

## 📸 Visual Testing Tips

1. **Open Browser DevTools:**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Check Console tab for errors
   - Check Network tab to see API calls

2. **Test Different Phone Formats:**
   - Try: `555-123-4567`
   - Try: `(555) 123-4567`
   - Try: `5551234567`
   - All should normalize and match correctly

3. **Test Email Variations:**
   - Try: `test@example.com`
   - Try: `TEST@EXAMPLE.COM` (should match due to lowercase normalization)

---

## ✅ Success Criteria

All tests pass if:

1. ✅ Duplicate email shows error on email field
2. ✅ Duplicate phone shows error on phone field (was broken before!)
3. ✅ Duplicate both shows errors on BOTH fields (new feature!)
4. ✅ All error messages show "Mahad program" (capitalized)
5. ✅ No console errors
6. ✅ Form validation works correctly

---

## 🎉 You're Done!

Once all tests pass, you've successfully verified all three improvements:

1. ✅ Optimized `areSiblings` query
2. ✅ Improved 'both' duplicate field UX
3. ✅ Fixed error message capitalization

Happy testing! 🚀
