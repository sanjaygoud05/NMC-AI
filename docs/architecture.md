# SIH26099 Architecture Documentation

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                              │
│                    (React + TypeScript)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Dashboard│  │ Materials│  │ Matching │  │  Review  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│                      (FastAPI + Python)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   API    │  │ Services │  │ Pipeline │  │   AI/ML  │  │
│  │  Routes  │  │  Layer   │  │  Engine  │  │  Engine  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│                   (PostgreSQL/Supabase)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Materials│  │  Matches │  │  Master  │  │  Users   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

#### Component Structure

```
client/src/
├── components/
│   ├── layout/              # Layout components
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── Header.tsx
│   ├── dashboard/           # Dashboard components
│   │   ├── KPICard.tsx
│   │   ├── AttentionPanel.tsx
│   │   └── MaterialStats.tsx
│   ├── materials/           # Material management
│   │   ├── MaterialTable.tsx
│   │   ├── MaterialFilters.tsx
│   │   └── MaterialDetails.tsx
│   ├── matching/            # Matching components
│   │   ├── MatchTable.tsx
│   │   ├── MatchCard.tsx
│   │   └── SimilarityScore.tsx
│   ├── review/              # Review workflow
│   │   ├── ReviewQueue.tsx
│   │   ├── ReviewPanel.tsx
│   │   └── DecisionButtons.tsx
│   ├── master/              # Common master
│   │   ├── CommonMasterTable.tsx
│   │   └── LegacyMappingTable.tsx
│   ├── procurement/         # Procurement intelligence
│   │   ├── ProcurementKPIs.tsx
│   │   └── ConsolidationOpportunities.tsx
│   └── ui/                  # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── table.tsx
│       └── ...
├── pages/                   # Page components
│   ├── Dashboard.tsx
│   ├── Materials.tsx
│   ├── Matches.tsx
│   └── Review.tsx
├── hooks/                   # React hooks
│   ├── useMaterials.ts
│   ├── useMatches.ts
│   └── useReview.ts
├── services/                # API services
│   ├── materialService.ts
│   ├── matchingService.ts
│   └── reviewService.ts
├── types/                   # TypeScript types
│   ├── material.ts
│   ├── match.ts
│   └── review.ts
└── lib/                     # Utilities
    ├── utils.ts
    └── mock/               # Mock data
```

#### State Management

- **TanStack Query**: Server state management and caching
- **React Context**: Theme and authentication state
- **Local State**: Component-level state with useState

### Backend Architecture

#### Layer Structure

```
server/
├── app/
│   ├── main.py              # Application entry point
│   ├── config.py            # Configuration management
│   ├── dependencies.py      # Dependency injection
│   └── api/                 # API routes
│       ├── health.py
│       ├── materials.py
│       ├── matches.py
│       ├── review.py
│       └── analytics.py
├── services/               # Business logic
│   ├── ingestion_service.py
│   ├── profiling_service.py
│   ├── cleaning_service.py
│   ├── attribute_service.py
│   ├── standardization_service.py
│   ├── embedding_service.py
│   ├── matching_service.py
│   ├── validation_service.py
│   ├── confidence_service.py
│   └── review_service.py
├── pipeline/               # Processing pipeline
│   ├── pipeline_runner.py
│   ├── phase01_ingestion.py
│   ├── phase02_profiling.py
│   └── ... (phases 3-16)
├── ai/                     # AI/ML components
│   ├── embeddings.py
│   ├── gemini_fallback.py
│   └── prompts.py
├── matching/               # Matching algorithms
│   ├── vector_matcher.py
│   ├── fuzzy_matcher.py
│   ├── candidate_generator.py
│   └── score_combiner.py
└── rules/                  # Domain rules
    ├── attribute_rules.py
    ├── validation_rules.py
    ├── abbreviation_dictionary.py
    ├── uom_rules.py
    └── material_rules.py
```

#### API Design

**RESTful Endpoints:**

```
GET    /api/health
GET    /api/materials
GET    /api/materials/{id}
PUT    /api/materials/{id}
DELETE /api/materials/{id}
GET    /api/materials/common/list
GET    /api/materials/common/{code}

GET    /api/matches
GET    /api/matches/{id}
POST   /api/matches/{id}/accept
POST   /api/matches/{id}/reject

GET    /api/review/queue
GET    /api/review/{id}
POST   /api/review/{id}/decision

GET    /api/analytics/dashboard
GET    /api/analytics/cpse
GET    /api/analytics/data-quality
GET    /api/analytics/procurement
GET    /api/analytics/evaluation

POST   /api/ingest/upload
POST   /api/ingest/validate
POST   /api/ingest/process
```

### Data Architecture

#### Database Schema (Conceptual)

```
materials
├── id
├── material_code
├── cpse_id
├── description
├── normalized_description
├── standardized_description
├── category
├── material_type
├── unit
├── manufacturer
├── attributes (JSONB)
├── standardization_status
├── match_status
└── confidence_score

matches
├── id
├── source_material_id
├── candidate_material_id
├── semantic_score
├── fuzzy_score
├── attribute_score
├── confidence_score
└── decision

common_materials
├── common_code
├── standardized_description
├── category
├── material_type
├── unit
├── specifications (JSONB)
├── legacy_count
└── created_at

legacy_mappings
├── id
├── common_code
├── legacy_material_id
├── legacy_material_code
├── cpse_id
├── confidence_score
└── mapping_date
```

### Security Architecture

#### Authentication
- Supabase Auth for user authentication
- JWT token-based API authentication
- Role-based access control (RBAC)

#### Authorization
- Admin: Full system access
- Manager: Review and approve matches
- Analyst: Read-only access to analytics
- User: Basic material access

#### Data Security
- Environment-based configuration
- Encrypted database connections
- Input validation on all endpoints
- SQL injection prevention (ORM)
- XSS protection (React)

### Deployment Architecture

#### Development
```
Frontend: Vite dev server (localhost:5173)
Backend: Uvicorn (localhost:8000)
Database: Local PostgreSQL or Supabase
```

#### Production
```
Frontend: Vercel/Netlify (CDN)
Backend: FastAPI on Docker/Cloud Run
Database: Supabase PostgreSQL
Vector DB: Pinecone/FAISS
```

## Technology Choices

### Frontend
- **React**: Component-based UI, large ecosystem
- **TypeScript**: Type safety, better developer experience
- **Vite**: Fast build tool, modern HMR
- **Tailwind CSS**: Utility-first CSS, rapid development
- **shadcn/ui**: Beautiful, accessible components
- **TanStack Query**: Powerful data fetching and caching

### Backend
- **FastAPI**: Modern, fast, automatic API docs
- **Python**: Rich ML/AI ecosystem
- **Pydantic**: Data validation, serialization
- **Supabase**: Managed PostgreSQL, auth, storage

### AI/ML
- **OpenAI Embeddings**: High-quality text embeddings
- **Google Gemini**: LLM for complex tasks
- **FAISS**: Efficient vector similarity search
- **scikit-learn**: Traditional ML algorithms

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Caching with Redis (future)
- Load balancing

### Performance Optimization
- Database indexing
- Query optimization
- Frontend code splitting
- Image optimization
- CDN for static assets

### Data Processing
- Batch processing for large datasets
- Async task queue (Celery - future)
- Streaming for large file uploads
- Progress tracking for long operations
