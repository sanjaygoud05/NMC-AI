# SIH26099 — AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

An enterprise-grade platform for standardizing and harmonizing material codes across Central Public Sector Enterprises (CPSEs) using AI/ML techniques.

## Project Overview

SIH26099 addresses the challenge of material code inconsistency across different CPSEs by providing:

- **Data Ingestion**: Upload and validate material master data from multiple CPSEs
- **AI-Powered Matching**: Semantic and fuzzy matching to identify duplicate materials
- **Standardization**: Create a common material master with standardized descriptions
- **Human Review**: Expert review workflow for low-confidence matches
- **Procurement Intelligence**: Consolidation opportunities and cost savings analysis
- **Analytics**: Comprehensive dashboards and reporting

## Architecture

```
Dataset
   ↓
Data Ingestion
   ↓
Data Profiling
   ↓
Cleaning / Normalization
   ↓
Attribute Extraction
   ↓
Material Standardization
   ↓
Embeddings
   ↓
Candidate Generation
   ↓
Fuzzy + Vector Matching
   ↓
Attribute Validation
   ↓
Confidence Scoring
   ↓
Human Review
   ↓
Common Material Master
   ↓
Legacy Mapping
   ↓
Procurement Intelligence
   ↓
Analytics / Evaluation
```

## Project Structure

```
SIH26099-Material-Harmonization/
│
├── client/                 # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # React hooks
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript types
│   │   └── lib/            # Utilities and mock data
│   └── package.json
│
├── server/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Application entry point
│   │   ├── config.py       # Configuration
│   │   ├── dependencies.py # Dependencies
│   │   └── api/            # API routes
│   ├── services/           # Business logic services
│   ├── pipeline/           # Processing pipeline phases
│   ├── ai/                # AI/ML components
│   ├── matching/           # Matching algorithms
│   └── rules/             # Domain rules
│
├── data/                   # Data directory
│   ├── raw/               # Raw datasets
│   ├── processed/         # Processed data
│   ├── dictionaries/      # Reference dictionaries
│   └── evaluation/        # Evaluation data
│
├── ml/                     # ML/ML utilities
│   ├── embeddings/        # Embedding generation
│   ├── matching/          # Matching evaluation
│   └── evaluation/        # Model evaluation
│
├── tests/                  # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test fixtures
│
├── scripts/                # Utility scripts
│   ├── import_dataset.py
│   ├── clean_dataset.py
│   ├── seed_database.py
│   ├── generate_embeddings.py
│   ├── run_pipeline.py
│   └── evaluate_model.py
│
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── data-flow.md
│   ├── api-documentation.md
│   └── deployment.md
│
└── docker-compose.yml      # Docker orchestration
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **TanStack Query** - Data fetching
- **React Router** - Routing
- **Recharts** - Data visualization

### Backend
- **FastAPI** - Web framework
- **Python 3.11+** - Runtime
- **Pydantic** - Data validation
- **PostgreSQL** - Database (via Supabase)

### AI/ML
- **OpenAI Embeddings** - Text embeddings
- **Google Gemini** - LLM fallback
- **FAISS** - Vector similarity search
- **scikit-learn** - ML utilities

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (or Supabase account)

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
python -m app.main
```

The backend API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/api/docs`

### Environment Variables

Create `.env` files in both `client/` and `server/` directories:

**Client (.env)**
```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

**Server (.env)**
```
DATABASE_URL=postgresql://user:password@localhost/sih26099
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_key
EMBEDDING_MODEL=text-embedding-3-small
```

## Development

### Running Tests

```bash
# Frontend tests
cd client
npm test

# Backend tests
cd server
pytest
```

### Building for Production

```bash
# Frontend
cd client
npm run build

# Backend
cd server
# Use Docker or deploy to your preferred platform
```

### Using Docker

```bash
docker-compose up
```

## Phases

This project is being developed in phases:

- **Phase 0**: Architecture + Frontend Foundation ✅
- **Phase 1**: Dataset Ingestion + Profiling
- **Phase 2**: Cleaning + Normalization
- **Phase 3**: Attribute Extraction + Standardization
- **Phase 4**: Embeddings + Candidate Generation
- **Phase 5**: Fuzzy + Semantic Matching
- **Phase 6**: Technical Validation + Confidence
- **Phase 7**: Human Review
- **Phase 8**: Common Material Master + Legacy Mapping
- **Phase 9**: Procurement Intelligence
- **Phase 10**: Evaluation + Demo + Deployment

## Contributing

This is an SIH (Smart India Hackathon) project. For contributions, please follow the established coding standards and submit pull requests to the main branch.

## License

This project is developed for the Smart India Hackathon 2024.

## Acknowledgments

- Built with [Lovable](https://lovable.dev) - Initial frontend template
- CPSE Material Master data provided by project stakeholders
- AI/ML models and algorithms from open-source community
