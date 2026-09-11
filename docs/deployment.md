# SIH26099 Deployment Documentation

## Deployment Overview

This document covers deployment strategies for the SIH26099 Material Harmonization Platform across different environments.

## Environments

### Development
- **Frontend:** Vite dev server (localhost:5173)
- **Backend:** Uvicorn (localhost:8000)
- **Database:** Local PostgreSQL or Supabase development
- **Purpose:** Local development and testing

### Staging
- **Frontend:** Vercel/Netlify preview
- **Backend:** Cloud Run/Heroku staging
- **Database:** Supabase staging project
- **Purpose:** Pre-production testing

### Production
- **Frontend:** Vercel/Netlify production
- **Backend:** Cloud Run/AWS production
- **Database:** Supabase production project
- **Purpose:** Live production system

## Prerequisites

### Required Services
- Supabase account (for database and auth)
- Domain name (for production)
- SSL certificate (auto-provided by hosting platforms)
- Monitoring service (optional but recommended)

### Required Tools
- Docker and Docker Compose
- Node.js 18+
- Python 3.11+
- Git

## Deployment Options

### Option 1: Docker Compose (Recommended for Development)

#### Prerequisites
- Docker installed
- Docker Compose installed

#### Steps

1. **Clone repository**
```bash
git clone <repository-url>
cd wisdom-garden-bed
```

2. **Configure environment variables**
```bash
# Create .env files
cp client/.env.example client/.env
cp server/.env.example server/.env

# Edit both .env files with your configuration
```

3. **Build and start services**
```bash
docker-compose up -d
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

#### Docker Compose Services

The `docker-compose.yml` includes:
- **Frontend:** React application
- **Backend:** FastAPI application
- **Database:** PostgreSQL (or use Supabase externally)

### Option 2: Separate Frontend and Backend Deployment

#### Frontend Deployment (Vercel)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy frontend**
```bash
cd client
vercel
```

3. **Configure environment variables in Vercel dashboard**
```
VITE_API_BASE_URL=https://your-backend-url.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

#### Backend Deployment (Cloud Run)

1. **Build Docker image**
```bash
cd server
docker build -t gcr.io/PROJECT_ID/sih26099-backend .
```

2. **Push to Container Registry**
```bash
docker push gcr.io/PROJECT_ID/sih26099-backend
```

3. **Deploy to Cloud Run**
```bash
gcloud run deploy sih26099-backend \
  --image gcr.io/PROJECT_ID/sih26099-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

4. **Configure environment variables**
```bash
gcloud run services update sih26099-backend \
  --set-env-vars DATABASE_URL=your_database_url \
  --set-env-vars SUPABASE_URL=your_supabase_url \
  --set-env-vars SUPABASE_KEY=your_supabase_key
```

### Option 3: Supabase + Vercel (Recommended for Production)

#### Setup Supabase

1. **Create Supabase project**
   - Go to https://supabase.com
   - Create new project
   - Note project URL and anon key

2. **Configure database**
   - Run migrations in Supabase SQL editor
   - Set up Row Level Security (RLS)
   - Create necessary tables

3. **Configure authentication**
   - Enable email/password auth
   - Configure auth providers if needed
   - Set up user roles

#### Deploy Frontend to Vercel

1. **Connect repository to Vercel**
   - Import repository in Vercel
   - Configure build settings
   - Set root directory to `client`

2. **Configure environment variables**
```
VITE_API_BASE_URL=https://your-backend-url.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

3. **Deploy**
   - Vercel will auto-deploy on push to main branch

#### Deploy Backend to Cloud Run

Follow Option 2 backend deployment steps, using Supabase as the database.

## Environment Configuration

### Frontend Environment Variables

Create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Backend Environment Variables

Create `server/.env`:

```env
API_TITLE=SIH26099 Material Harmonization API
API_VERSION=0.1.0
DEBUG=False
HOST=0.0.0.0
PORT=8000

ALLOWED_ORIGINS=["https://your-frontend-url.com"]

DATABASE_URL=postgresql://user:password@localhost/sih26099
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

GEMINI_API_KEY=your_gemini_api_key
EMBEDDING_MODEL=text-embedding-3-small

DATA_DIR=../data
RAW_DATA_PATH=../data/raw/CPSE_Material_Master_cleaned.csv
```

## Database Setup

### Using Supabase (Recommended)

1. **Create tables via SQL editor**
```sql
-- Materials table
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code VARCHAR(255) NOT NULL,
  cpse_id VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  normalized_description TEXT,
  standardized_description TEXT,
  category VARCHAR(100),
  material_type VARCHAR(100),
  unit VARCHAR(20),
  manufacturer VARCHAR(255),
  attributes JSONB,
  standardization_status VARCHAR(50),
  match_status VARCHAR(50),
  confidence_score DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_material_id UUID REFERENCES materials(id),
  candidate_material_id UUID REFERENCES materials(id),
  semantic_score DECIMAL(5,4),
  fuzzy_score DECIMAL(5,4),
  attribute_score DECIMAL(5,4),
  confidence_score DECIMAL(5,4),
  decision VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Common materials table
CREATE TABLE common_materials (
  common_code VARCHAR(50) PRIMARY KEY,
  standardized_description TEXT NOT NULL,
  category VARCHAR(100),
  material_type VARCHAR(100),
  unit VARCHAR(20),
  specifications JSONB,
  legacy_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Legacy mappings table
CREATE TABLE legacy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_code VARCHAR(50) REFERENCES common_materials(common_code),
  legacy_material_id UUID REFERENCES materials(id),
  legacy_material_code VARCHAR(255),
  cpse_id VARCHAR(50),
  confidence_score DECIMAL(5,4),
  mapping_date TIMESTAMP DEFAULT NOW()
);
```

2. **Create indexes**
```sql
CREATE INDEX idx_materials_cpse_id ON materials(cpse_id);
CREATE INDEX idx_materials_status ON materials(standardization_status);
CREATE INDEX idx_matches_source ON matches(source_material_id);
CREATE INDEX idx_matches_candidate ON matches(candidate_material_id);
CREATE INDEX idx_matches_decision ON matches(decision);
```

3. **Set up Row Level Security (RLS)**
```sql
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_materials ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Public read access" ON materials
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON common_materials
  FOR SELECT USING (true);
```

### Using Local PostgreSQL

1. **Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

2. **Create database**
```bash
createdb sih26099
```

3. **Run migrations**
```bash
cd server
python -m alembic upgrade head
```

## Monitoring and Logging

### Application Monitoring

#### Recommended Tools
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Google Analytics** - User analytics
- **Supabase Dashboard** - Database monitoring

#### Logging Configuration

Backend logging configuration in `server/app/config.py`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Health Checks

Configure health check endpoints:

- **Frontend:** `/` (returns 200 if app is running)
- **Backend:** `/api/health` (returns health status)
- **Database:** Supabase health dashboard

## Performance Optimization

### Frontend Optimization

1. **Code splitting** - Implemented via React Router
2. **Image optimization** - Use Next.js Image or similar
3. **Bundle analysis** - Run `npm run build -- --analyze`
4. **CDN** - Vercel provides automatic CDN

### Backend Optimization

1. **Database indexing** - Create indexes on frequently queried fields
2. **Caching** - Implement Redis caching for frequent queries
3. **Connection pooling** - Configure database connection pool
4. **Async operations** - Use async/await for I/O operations

### Database Optimization

1. **Query optimization** - Use EXPLAIN ANALYZE
2. **Index maintenance** - Regularly rebuild indexes
3. **Vacuum** - Regular VACUUM operations
4. **Connection limits** - Configure appropriate connection limits

## Security Considerations

### Frontend Security

1. **Environment variables** - Never commit secrets
2. **HTTPS** - Enforce HTTPS in production
3. **Content Security Policy** - Configure CSP headers
4. **XSS protection** - React provides built-in XSS protection

### Backend Security

1. **Authentication** - JWT token-based auth
2. **Authorization** - Role-based access control
3. **Input validation** - Pydantic validation on all endpoints
4. **SQL injection** - Use ORM (SQLAlchemy)
5. **Rate limiting** - Implement rate limiting
6. **CORS** - Configure allowed origins

### Database Security

1. **Row Level Security** - Enable RLS in Supabase
2. **Encryption** - Use TLS for database connections
3. **Backups** - Enable automated backups
4. **Access control** - Limit database user permissions

## Backup and Recovery

### Database Backups

#### Supabase
- Automatic daily backups (included)
- Point-in-time recovery (7 days)
- Manual backup via dashboard

#### Local PostgreSQL
```bash
# Backup
pg_dump sih26099 > backup.sql

# Restore
psql sih26099 < backup.sql
```

### Application Backups

- **Code:** Git repository
- **Configuration:** Environment variables (store securely)
- **Data:** Database backups

## Scaling Considerations

### Horizontal Scaling

1. **Load balancer** - Use Cloud Load Balancing
2. **Multiple instances** - Run multiple backend instances
3. **Session management** - Use Redis for session storage
4. **Database scaling** - Use read replicas

### Vertical Scaling

1. **Instance size** - Increase CPU/memory
2. **Database tier** - Upgrade database instance
3. **Connection pool** - Increase pool size

## Troubleshooting

### Common Issues

#### Frontend won't build
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
```

#### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.11+

# Install dependencies
pip install -r requirements.txt

# Check environment variables
python -c "from app.config import settings; print(settings.DATABASE_URL)"
```

#### Database connection issues
```bash
# Test connection
psql $DATABASE_URL

# Check Supabase status
# Visit Supabase dashboard
```

### Getting Help

- Check application logs
- Review error messages
- Consult documentation
- Check GitHub issues
- Contact support team

## Maintenance

### Regular Tasks

- **Weekly:** Review error logs, monitor performance
- **Monthly:** Update dependencies, review security patches
- **Quarterly:** Review and optimize database, backup verification
- **Annually:** Security audit, capacity planning

### Dependency Updates

```bash
# Frontend
cd client
npm update

# Backend
cd server
pip install --upgrade -r requirements.txt
```

### Security Updates

- Subscribe to security advisories
- Monitor CVE database
- Apply security patches promptly
- Regular security audits
