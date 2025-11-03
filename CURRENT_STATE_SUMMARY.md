# FWA Detection Platform - Current State & Issues

**Date:** November 3, 2025
**Status:** Phase 3 patterns deployed but Modifier 25 detection not working

## ✅ What's Working

1. **Tier 1 Detection (Basic Patterns):**
   - Duplicate detection ✅
   - Round number detection ✅

2. **Tier 2 Detection (Peer Comparison):**
   - Fixed from 95th percentile to 99th + z-score > 3 ✅
   - Benford's Law threshold raised to 20 ✅
   - Gini coefficient threshold raised to 0.85 ✅
   - Spike detection z-score raised to 4 ✅
   - **Result:** Reduced false positives from 63 to 42 providers

3. **Phase 1 & 2 Advanced Patterns:**
   - Upcoding detection ✅
   - Modifier 59 abuse ✅
   - Time impossibilities ✅
   - Unbundling violations ✅
   - Temporal spikes ✅

4. **Phase 3 Patterns (Partially Working):**
   - Billing inflation drift ✅ (P8003, P8021 both detected)
   - Place of Service drift ✅ (P8015 detected)

## ❌ Critical Issues

### Issue #1: Modifier 25 Detection NOT Working
**Expected:** P8003 and P8021 should show "Modifier 25 Overuse" pattern
**Actual:** Only shows "Billing Inflation Drift"

**Evidence from Excel data:**
- P8003 has 77 claims with nearly ALL having modifier 25
- In the Excel file, modifiers show as numbers: `25`, not strings: `"25"`

**Code attempts:**
1. `c.modifiers && /\b25\b/.test(c.modifiers)` - Failed (regex on number)
2. `c.modifiers && String(c.modifiers).includes("25")` - Still failing
3. Added debug logging but can't see output

**Current threshold:** >8% of E&M visits with modifier 25 (lowered from 10%)
**Current minimum:** 5 E&M visits (lowered from 10)

**File:** `src/lib/detection/phase3-patterns.ts` lines 78-80

### Issue #2: Too Many Providers Still Flagged
**Expected:** ~8-10 providers flagged (per ground truth)
**Actual:** 42 providers flagged (should be closer to 10)

**Root cause:** Providers with all zero scores still included in output

**Need:** Filter providers where `overallScore < 10` from results

### Issue #3: Other Phase 3 Patterns Not Tested
- **Psychotherapy duration creep** - not verified
- **Telehealth volume bursts** - not verified  
- **Wound care frequency** - not verified

## 📊 Ground Truth Expectations

From `FWA_Realistic_Noise_v1_GroundTruth.xlsx`:

| Provider | Expected Pattern | Status |
|----------|-----------------|--------|
| P8003 | Modifier 25 Misuse | ❌ NOT DETECTED |
| P8021 | Modifier 25 Misuse | ❌ NOT DETECTED |
| P8015 | POS Drift | ✅ DETECTED |
| P8039 | POS Drift | ❓ Not checked |
| P8047 | Psychotherapy Duration Creep | ❓ Shows only billing inflation |
| P8055 | Telehealth Bursts | ❓ Not checked |
| P8062 | Wound Care Frequency | ❓ Not checked |
| P8029 | Billing Inflation | ✅ DETECTED |
| P8058 | Billing Inflation | ❓ Not checked |

## 🔧 Immediate Next Steps

### Priority 1: Fix Modifier 25 Detection
**Need to determine:** How is the `modifiers` field actually parsed from Excel?

**Debug approach:**
```typescript
// In phase3-patterns.ts, add this before the filter:
const sampleClaim = emCodes[0];
console.log({
  modifiers: sampleClaim.modifiers,
  type: typeof sampleClaim.modifiers,
  raw: JSON.stringify(sampleClaim.modifiers),
  string: String(sampleClaim.modifiers),
  includes: String(sampleClaim.modifiers).includes("25")
});
```

**Possible fixes to try:**
1. Check if modifiers is an array: `Array.isArray(c.modifiers) && c.modifiers.includes(25)`
2. Check multiple formats: `[25, "25", " 25", "25 "].some(m => String(c.modifiers).includes(String(m)))`
3. Parse from Excel differently in upload route

### Priority 2: Add Minimum Score Filter
```typescript
// In orchestrator.ts, filter results before returning
const filteredLeads = leads.filter(lead => lead.overallScore >= 10);
```

### Priority 3: Verify All Phase 3 Patterns
Need to check expanded view for:
- P8047 (psychotherapy)
- P8055 (telehealth) 
- P8062 (wound care)

## 📁 Key Files Modified

1. **Detection Logic:**
   - `src/lib/detection/orchestrator.ts` - Main detection pipeline
   - `src/lib/detection/phase3-patterns.ts` - Sophisticated patterns
   - `src/lib/detection/tier2.ts` - Peer comparison (fixed thresholds)
   - `src/lib/detection/advanced-patterns.ts` - Phase 1 & 2 patterns

2. **API Routes:**
   - `src/app/api/upload/route.ts` - File upload & detection trigger
   - `src/app/api/agent/analyze-lead/route.ts` - AI analysis with structured output

3. **Frontend:**
   - `src/components/AnalysisDisplay.tsx` - Structured analysis display
   - `src/app/leads/[providerId]/page.tsx` - Provider detail page

4. **Utilities:**
   - `src/lib/formatting/report-formatter.ts` - Consistent formatting (fixes +- and $- bugs)
   - `src/lib/agent/schemas.ts` - Zod validation schemas

## 🎯 Success Criteria

1. P8003 & P8021 show "Modifier 25 Overuse" with correct percentage
2. Total flagged providers: 8-12 (not 42)
3. All Phase 3 patterns verified working
4. Zero false positives on clean providers (tier scores all 0)
5. AI analysis shows correct formatted deviations (no +- or $-)

## 💾 Test Data Location

- **Realistic dataset:** `/Users/timwetherill/Desktop/FWA-Test-Data/FWA_Realistic_Noise_v1.xlsx`
- **Ground truth:** `/Users/timwetherill/Desktop/FWA-Test-Data/FWA_Realistic_Noise_v1_GroundTruth.xlsx`
- **QA test data:** `Advanced_Detection_QA_Test_Dataset.xlsx` (works perfectly)

## 🚀 Deployment Info

- **Repo:** https://github.com/wetherillt-punch/MFY-FWA-platform
- **Production URL:** https://fwa-detection-platform.vercel.app
- **Latest commit:** eae7fe9 - "Add debug logging for modifier 25 detection"
