# FWA Anomaly Detection Platform

A production-ready explainable fraud/waste/abuse detection system for healthcare claims.

## Features

✅ **Works with minimal data** - Only 4 required fields
✅ **4-tier detection** - Deterministic, Statistical, Behavioral, Watchlist
✅ **Explainable AI** - Every flag has clear reasoning and evidence
✅ **Peer clustering** - Automatic provider grouping without specialty codes
✅ **Two-screen UI** - Lead Overview + Claims Evidence
✅ **Deterministic** - Reproducible results with full provenance
✅ **Export ready** - PDF reports and CSV bundles

## Quick Start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Architecture

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Prisma
- **Detection**: TypeScript algorithms (NumPy-style logic)
- **Exports**: PDF + CSV generation

## Project Structure

```
fwa-detection-platform/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx           # Dashboard home
│   │   ├── leads/             # Lead Overview screen
│   │   └── api/               # API endpoints
│   ├── components/            # React components
│   ├── lib/
│   │   ├── detection/         # Detection algorithms
│   │   ├── clustering/        # Peer grouping
│   │   ├── scoring/           # Scoring engine
│   │   └── explainability/    # Narrative generation
│   └── types/                 # TypeScript types
├── prisma/
│   └── schema.prisma          # Database schema
└── docs/                      # Documentation
```

## Detection Tiers

**Tier 1 - Hard/Deterministic:**
- Duplicate claims (hash collisions)
- Round-number clustering
- Holiday/weekend concentration

**Tier 2 - Statistical:**
- Burstiness & spikes (z-scores)
- Benford's Law deviation
- Gini/HHI concentration
- Peer-relative outliers

**Tier 3 - Behavioral:**
- Claim-splitting patterns
- Anchoring (repeated amounts)
- Change-points (step-ups)

**Tier 4 - Watchlist:**
- Gradual drift
- Emerging patterns below thresholds
