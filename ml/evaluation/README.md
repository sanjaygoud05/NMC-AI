# ML Evaluation & Benchmarking Module — Phase 10

This module contains quantitative evaluation scripts, benchmark datasets, and reporting tools for validating model performance against domain expert golden truth.

## Metrics & KPIs

- **Precision**: Ratio of true duplicate matches over all predicted matches (minimizing false consolidations)
- **Recall**: Proportion of true synonymous CPSE pairs captured by the model
- **F1 Score**: Harmonic mean of Precision and Recall
- **Accuracy**: Overall classification accuracy on annotated benchmark sets
- **Threshold Sensitivity**: Receiver Operating Characteristic (ROC) and Precision-Recall Curves

## Golden Datasets

Benchmark ground-truth annotation pairs reside in `data/evaluation/`:
- Hand-labeled CPSE material pairs with binary match labels and domain expert notes.
