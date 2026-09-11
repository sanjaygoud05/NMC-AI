# ML Embeddings Module — Phase 4

This module is reserved for dense semantic vector representation and embedding generation for material descriptions across CPSEs.

## Architecture

- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` or `BAAI/bge-small-en-v1.5`
- **Dimension**: 384-dimensional dense vectors
- **Indexing**: FAISS / pgvector similarity search
- **Input**: Normalized material descriptions produced by Phase 3 (Standardization)
- **Output**: Vector embeddings cached and stored with material records

## Planned Implementation (Phase 4)

1. `vectorizer.py`: Batch embedding inference using sentence-transformers
2. `vector_store.py`: Vector index creation and k-NN query runner
3. `cache.py`: Local embedding cache to avoid redundant inferences
