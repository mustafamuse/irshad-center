# Intercepting Routes Implementation - Student Details

## 🎯 What We Built

Implemented Next.js 13+ **Intercepting Routes** for student details, enabling:
- ✅ **Modal on list** - Click student → Modal opens
- ✅ **Shareable URLs** - `/cohorts/students/abc123` works as a link
- ✅ **Persistent state** - Refresh keeps modal open
- ✅ **Full page fallback** - Direct navigation shows full page
- ✅ **Better UX** - Back button closes modal

---

## 📁 File Structure

```
app/admin/mahad/cohorts/
├── layout.tsx                              ← Orchestrates parallel routes
│
├── @modal/                                  ← Parallel route slot for modals
│   ├── default.tsx                          ← Empty state (no modal)
│   └── (..)students/[id]/                   ← Intercepting route
│       ├── page.tsx                         ← Server component (fetches data)
│       └── student-detail-modal.tsx         ← Client component (Dialog UI)
│
├── students/[id]/                           ← Full page route
│   ├── page.tsx                             ← Full page view
│   ├── loading.tsx                          ← Loading skeleton
│   └── error.tsx                            ← Error boundary
│
└── components/students-table/
    ├── student-details-content.tsx          ← Shared content component
    ├── student-details-sheet.tsx            ← DEPRECATED (kept for compatibility)
    ├── student-columns.tsx                  ← Updated to use Link
    └── mobile-students-list.tsx             ← Updated to use Link
```

---

## 🚀 How It Works

### **Scenario 1: Click student in list**
```
User on: /admin/mahad/cohorts
Clicks student →
URL changes to: /admin/mahad/cohorts/students/abc123
Renders: @modal/(..)students/[id]/page.tsx (Modal overlay)
```

### **Scenario 2: Refresh with modal open**
```
User on: /admin/mahad/cohorts/students/abc123
Presses F5 →
URL stays: /admin/mahad/cohorts/students/abc123
Renders: @modal/(..)students/[id]/page.tsx (Modal persists)
```

### **Scenario 3: Direct navigation**
```
User types URL: /admin/mahad/cohorts/students/abc123
Or opens in new tab →
Renders: students/[id]/page.tsx (Full page, not modal)
```

### **Scenario 4: Share link**
```
User copies: /admin/mahad/cohorts/students/abc123
Sends to colleague →
Colleague sees: Full page version
(Intercepting routes only work when navigating from within the app)
```

---

## 🔧 Key Components

### **1. Layout with Parallel Routes**
`app/admin/mahad/cohorts/layout.tsx`

```tsx
export default function CohortsLayout({ children, modal }: LayoutProps) {
  return (
    <>
      {children}
      {modal} {/* Renders when route matches @modal/(..)students/[id] */}
    </>
  )
}
```

### **2. Intercepting Route (Modal)**
`@modal/(..)students/[id]/page.tsx`

- Server component that fetches student data
- Renders `StudentDetailModal` client component
- `(..)` means "intercept /students/[id] route"

### **3. Full Page Route**
`students/[id]/page.tsx`

- Same data fetching as modal
- Renders in full page layout
- Includes back button to cohorts list

### **4. Shared Content Component**
`student-details-content.tsx`

- Reusable content used by both modal and full page
- Contains all sections (BasicInfo, Batch, Education, Siblings)
- Handles edit mode and form submission

---

## 📊 URL Patterns

| URL | View Mode | Query Params |
|-----|-----------|--------------|
| `/cohorts/students/abc123` | View mode | Default |
| `/cohorts/students/abc123?mode=edit` | Edit mode | `?mode=edit` |

---

## 🎨 UI Differences

### **Modal Version** (Intercepting Route)
- Opens as Dialog overlay
- Dismisses with ESC or clicking outside
- `router.back()` closes modal
- Max width: 3xl
- Scrollable content area

### **Full Page Version** (Direct Navigation)
- Full page layout
- Back button to cohorts list
- Max width: 4xl
- Card-based design with shadow

---

## 🧪 Testing Checklist

### ✅ **Modal Behavior**
- [ ] Click student in list → Modal opens
- [ ] Press ESC → Modal closes and navigates back
- [ ] Click outside modal → Modal closes
- [ ] Click "Edit" → URL updates to `?mode=edit`
- [ ] Save changes → Toast shows, modal stays open in view mode
- [ ] Refresh with modal open → Modal persists

### ✅ **Full Page Behavior**
- [ ] Type URL directly → Shows full page (not modal)
- [ ] Open in new tab → Shows full page
- [ ] Back button → Returns to cohorts list
- [ ] Edit mode works → Form submission updates data

### ✅ **Mobile Compatibility**
- [ ] Click card on mobile → Modal opens
- [ ] Checkbox clicks don't trigger navigation
- [ ] Modal is scrollable on small screens

### ✅ **SEO & Metadata**
- [ ] Page title shows student name
- [ ] Meta description includes status and batch
- [ ] Open Graph tags populate correctly

---

## 🔄 Migration Notes

### **What Changed**
1. **StudentDetailsSheet** - Still works, but marked DEPRECATED
2. **student-columns.tsx** - Uses Link instead of onClick
3. **mobile-students-list.tsx** - Wraps cards with Link
4. **student-card.tsx** - Prevents link navigation on checkbox click

### **Backward Compatibility**
- Old Sheet-based approach still works
- Gradual migration recommended
- Both approaches can coexist

### **Future Work**
- Remove StudentDetailsSheet after full migration
- Add intercepting routes for batch creation
- Add intercepting routes for delete confirmations

---

## 🐛 Troubleshooting

### **Modal doesn't open**
- Check that layout.tsx accepts `modal` prop
- Verify `(..)` notation is correct (two levels up)
- Ensure Link href matches route structure

### **Modal shows full page instead**
- Intercepting routes only work on client-side navigation
- Direct URL entry always shows full page (by design)
- Check if navigating via Link component

### **Checkbox triggers navigation**
- Ensure `e.preventDefault()` on checkbox click
- Wrap checkbox in div with onClick handler

### **Data not loading**
- Check `getStudentById()` returns data
- Verify student ID is valid
- Check network tab for failed requests

---

## 📚 Resources

- [Next.js Intercepting Routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)
- [Next.js Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [Dialog Component (shadcn)](https://ui.shadcn.com/docs/components/dialog)

---

## 🎯 Next Steps

1. **Test the implementation** - Follow testing checklist above
2. **Add more intercepting routes** - Batch creation, delete confirmations
3. **Remove deprecated code** - After full migration
4. **Add loading states** - Suspense boundaries for progressive rendering
5. **Optimize metadata** - Dynamic OG images for social sharing
