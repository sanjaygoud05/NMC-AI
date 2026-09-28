# SIH26099 Data Flow Documentation

## Complete Data Pipeline

### Phase 1: Data Ingestion

```
CPSE A (CSV) ──┐
CPSE B (CSV) ──┼──→ File Upload ──→ Validation ──→ Storage (data/raw/)
CPSE C (CSV) ──┘
```

**Input:** Raw CSV files from CPSEs
**Output:** Validated raw material data
**Validation Checks:**
- File format (CSV)
- Required columns present
- Data type validation
- Duplicate file detection

### Phase 2: Data Profiling

```
Raw Data ──→ Column Analysis ──→ Statistics ──→ Quality Report
```

**Analysis:**
- Column distribution
- Data type identification
- Missing value analysis
- Outlier detection
- Pattern recognition

**Output:** Profiled data with quality metrics

### Phase 3: Data Cleaning

```
Profiled Data ──→ Deduplication ──→ Missing Value Handling ──→ Normalization
```

**Cleaning Steps:**
- Remove exact duplicates
- Handle missing values (impute or flag)
- Standardize date formats
- Normalize text (case, spacing)
- Fix inconsistent units

**Output:** Cleaned material data (data/processed/cleaned_materials.csv)

### Phase 4: Attribute Extraction

```
Cleaned Data ──→ NLP Processing ──→ Attribute Extraction ──→ Validation
```

**Extraction Targets:**
- Material type (Steel, Cement, etc.)
- Specifications (thickness, grade, size)
- Unit of measurement
- Manufacturer
- Technical attributes

**Methods:**
- Rule-based extraction
- Pattern matching
- LLM-assisted extraction (Gemini fallback)

**Output:** Extracted attributes (data/processed/extracted_attributes.csv)

### Phase 5: Material Standardization

```
Extracted Attributes ──→ Standard Application ──→ Description Standardization
```

**Standardization:**
- Apply domain standards
- Normalize terminology
- Standardize abbreviations
- Create consistent descriptions
- Map to material categories

**Output:** Standardized materials (data/processed/standardized_materials.csv)

### Phase 6: Embedding Generation

```
Standardized Descriptions ──→ Text Preprocessing ──→ Embedding Model ──→ Vector Storage
```

**Process:**
- Text preprocessing (tokenization, cleaning)
- Embedding generation (OpenAI/local model)
- Vector storage (FAISS/Pinecone)
- Metadata indexing

**Output:** Embeddings and metadata (data/processed/embeddings_metadata.csv)

### Phase 7: Candidate Generation

```
Material ──→ Filtering ──→ Candidate Selection ──→ Initial Pairs
```

**Filtering:**
- Category matching
- Material type matching
- CPSE filtering
- Size constraints

**Output:** Candidate pairs for matching

### Phase 8: Matching (Vector + Fuzzy)

```
Candidate Pairs ──┬──→ Vector Similarity ──┐
                  └──→ Fuzzy Similarity ──┼──→ Combined Scores
                                       └──→ Attribute Comparison
```

**Scoring Components:**
- **Semantic Score:** Cosine similarity of embeddings
- **Fuzzy Score:** String similarity (Levenshtein)
- **Attribute Score:** Structured attribute comparison

**Output:** Match candidates with scores

### Phase 9: Technical Validation

```
Matched Pairs ──→ Rule Validation ──→ Compatibility Check ──→ Validation Result
```

**Validation Rules:**
- Attribute compatibility
- Specification matching
- Technical constraints
- Domain-specific rules

**Output:** Validated matches

### Phase 10: Confidence Scoring

```
Validated Matches ──→ Score Combination ──→ Weighting ──→ Confidence Classification
```

**Score Combination:**
- Weighted average of components
- Customizable weights per domain
- Threshold-based classification

**Confidence Levels:**
- **High (≥0.90):** Auto-accept
- **Medium (0.70-0.89):** Review recommended
- **Low (<0.70):** Manual review required

**Output:** Matches with confidence scores

### Phase 11: Human Review

```
Low/Medium Confidence ──→ Review Queue ──→ Expert Review ──→ Decision
```

**Review Process:**
- Queue prioritization (by confidence, priority)
- Assignment to reviewers
- Decision capture (accept/reject/modify)
- Audit trail

**Output:** Reviewed matches with decisions

### Phase 12: Common Material Master

```
Accepted Matches ──→ Common Material Creation ──→ Master Entry
```

**Master Creation:**
- Generate common code
- Create standardized description
- Aggregate specifications
- Link legacy materials

**Output:** Common material master entries

### Phase 13: Legacy Mapping

```
Common Material ──←→ Legacy Materials ──→ Bidirectional Mapping
```

**Mapping:**
- One-to-many relationships
- Mapping confidence
- Historical tracking
- Conflict resolution

**Output:** Legacy mappings (data/processed/validated_matches.csv)

### Phase 14: Procurement Intelligence

```
Common Master ──→ Demand Analysis ──→ Consolidation Analysis ──→ Savings Calculation
```

**Analysis:**
- Aggregate demand across CPSEs
- Identify consolidation opportunities
- Calculate volume discounts
- Estimate potential savings

**Output:** Procurement insights and recommendations

### Phase 15: Dashboard Analytics

```
All Data ──→ Metric Calculation ──→ Visualization ──→ Dashboard
```

**Metrics:**
- Total materials by CPSE
- Standardization progress
- Match statistics
- Review queue status
- Data quality scores
- Procurement KPIs

**Output:** Dashboard analytics and visualizations

### Phase 16: Evaluation

```
Predictions ──→ Golden Dataset Comparison ──→ Metrics Calculation ──→ Report
```

**Evaluation Metrics:**
- Precision, Recall, F1
- Accuracy
- False positive/negative rates
- Confidence calibration

**Output:** Evaluation reports

## Data Storage Strategy

### Raw Data
- **Location:** `data/raw/`
- **Format:** Original CSV from CPSEs
- **Retention:** Permanent (audit trail)

### Processed Data
- **Location:** `data/processed/`
- **Format:** CSV with standardized schema
- **Retention:** As needed (can be regenerated)

### Dictionaries
- **Location:** `data/dictionaries/`
- **Format:** CSV/JSON
- **Content:** Reference data (UOM, standards, abbreviations)

### Evaluation Data
- **Location:** `data/evaluation/`
- **Format:** CSV, reports
- **Content:** Golden dataset, evaluation results

## Data Quality Monitoring

### Quality Metrics
- Completeness: % of required fields filled
- Consistency: % of values following standards
- Accuracy: % of values validated against rules
- Timeliness: Data freshness

### Monitoring Points
- After ingestion
- After cleaning
- After standardization
- After matching
- After review

## Error Handling

### Data Errors
- Validation failures: Log and reject
- Missing data: Flag for review
- Inconsistent data: Apply rules or flag
- Format errors: Attempt correction or reject

### Process Errors
- Pipeline failures: Stop and alert
- Timeout errors: Retry with backoff
- Resource errors: Scale or optimize
- Integration errors: Fallback to manual process

## Performance Considerations

### Batch Processing
- Process in chunks (1000 records/batch)
- Parallel processing where possible
- Progress tracking for long operations
- Checkpoint/resume capability

### Caching Strategy
- Cache embeddings (expensive to generate)
- Cache similarity results
- Cache dictionary lookups
- Invalidate on data changes

### Storage Optimization
- Compress historical data
- Archive old processed data
- Use efficient data types
- Index frequently queried fields
