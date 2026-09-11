# ML Matching & Harmonization Module — Phase 5

This module implements hybrid multi-stage candidate matching across heterogeneous CPSE catalogs.

## Architecture

1. **Candidate Retrieval (Blocking & Filtering)**:
   - Primary category / material group filtering
   - k-NN approximate nearest neighbor candidate retrieval via vector embeddings
2. **Multi-Model Scoring Ensemble**:
   - **Semantic Similarity**: Cosine distance on dense vector embeddings
   - **Fuzzy Token Ratio**: RapidFuzz token-sort and partial ratio
   - **Attribute Alignment**: Exact and tolerance-based matching on extracted technical attributes (size, grade, standard, rating)
3. **Score Combination & Decision Policy**:
   - $\ge 0.90$ &rarr; Auto-Accepted Harmonization
   - $0.75 - 0.89$ &rarr; Routed to Subject Matter Expert (SME) Review Queue
   - $< 0.75$ &rarr; Rejected / Distinct Material
