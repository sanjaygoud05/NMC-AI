# SIH26099 API Documentation

## Base URL

```
Development: http://localhost:8000
Production: https://api.sih26099.example.com
```

## Authentication

All API endpoints require authentication via JWT token.

```
Authorization: Bearer <token>
```

## Response Format

All responses follow this structure:

```json
{
  "data": {},
  "error": null,
  "message": "Success"
}
```

## Endpoints

### Health

#### GET /api/health

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.1.0"
}
```

### Materials

#### GET /api/materials

Get materials with optional filters.

**Query Parameters:**
- `skip` (integer, default: 0) - Number of records to skip
- `limit` (integer, default: 100) - Number of records to return
- `cpse_id` (string, optional) - Filter by CPSE ID
- `category` (string, optional) - Filter by category
- `status` (string, optional) - Filter by standardization status

**Response:**
```json
{
  "materials": [
    {
      "id": "1",
      "material_code": "CPSE-A-001",
      "cpse_id": "CPSE-A",
      "description": "Steel Plate 10mm",
      "normalized_description": "steel plate 10mm",
      "standardized_description": "Steel Plate 10mm",
      "category": "Raw Materials",
      "material_type": "Steel",
      "unit": "KG",
      "manufacturer": "Tata Steel",
      "attributes": {
        "thickness": "10mm",
        "grade": "IS 2062",
        "surface": "Hot Rolled"
      },
      "standardization_status": "standardized",
      "match_status": "matched",
      "confidence_score": 0.95
    }
  ],
  "total": 1250,
  "skip": 0,
  "limit": 100
}
```

#### GET /api/materials/{material_id}

Get a specific material by ID.

**Path Parameters:**
- `material_id` (string, required) - Material ID

**Response:**
```json
{
  "id": "1",
  "material_code": "CPSE-A-001",
  "cpse_id": "CPSE-A",
  "description": "Steel Plate 10mm",
  "normalized_description": "steel plate 10mm",
  "standardized_description": "Steel Plate 10mm",
  "category": "Raw Materials",
  "material_type": "Steel",
  "unit": "KG",
  "manufacturer": "Tata Steel",
  "attributes": {
    "thickness": "10mm",
    "grade": "IS 2062",
    "surface": "Hot Rolled"
  },
  "standardization_status": "standardized",
  "match_status": "matched",
  "confidence_score": 0.95
}
```

#### PUT /api/materials/{material_id}

Update a material.

**Path Parameters:**
- `material_id` (string, required) - Material ID

**Request Body:**
```json
{
  "description": "Updated description",
  "category": "Updated category",
  "attributes": {
    "thickness": "12mm"
  }
}
```

**Response:**
```json
{
  "id": "1",
  "message": "Material updated successfully"
}
```

#### DELETE /api/materials/{material_id}

Delete a material.

**Path Parameters:**
- `material_id` (string, required) - Material ID

**Response:**
```json
{
  "id": "1",
  "message": "Material deleted successfully"
}
```

#### GET /api/materials/common/list

Get common materials from master.

**Query Parameters:**
- `skip` (integer, default: 0) - Number of records to skip
- `limit` (integer, default: 100) - Number of records to return

**Response:**
```json
{
  "common_materials": [
    {
      "common_code": "CM-001",
      "standardized_description": "Steel Plate 10mm",
      "category": "Raw Materials",
      "material_type": "Steel",
      "unit": "KG",
      "specifications": {
        "thickness": "10mm",
        "grade": "IS 2062",
        "surface": "Hot Rolled"
      },
      "legacy_count": 3,
      "created": "2024-01-10T00:00:00Z"
    }
  ],
  "total": 156,
  "skip": 0,
  "limit": 100
}
```

#### GET /api/materials/common/{common_code}

Get a common material by code.

**Path Parameters:**
- `common_code` (string, required) - Common material code

**Response:**
```json
{
  "common_code": "CM-001",
  "standardized_description": "Steel Plate 10mm",
  "category": "Raw Materials",
  "material_type": "Steel",
  "unit": "KG",
  "specifications": {
    "thickness": "10mm",
    "grade": "IS 2062",
    "surface": "Hot Rolled"
  },
  "legacy_count": 3,
  "created": "2024-01-10T00:00:00Z",
  "legacy_mappings": [
    {
      "id": "map-1",
      "legacy_material_id": "1",
      "legacy_material_code": "CPSE-A-001",
      "cpse_id": "CPSE-A",
      "confidence_score": 0.95
    }
  ]
}
```

### Matches

#### GET /api/matches

Get material matches with optional filters.

**Query Parameters:**
- `skip` (integer, default: 0) - Number of records to skip
- `limit` (integer, default: 100) - Number of records to return
- `decision` (string, optional) - Filter by decision (accepted, rejected, review, candidate)
- `min_confidence` (number, optional) - Minimum confidence score

**Response:**
```json
{
  "matches": [
    {
      "id": "match-1",
      "source_material_id": "1",
      "candidate_material_id": "2",
      "semantic_score": 0.92,
      "fuzzy_score": 0.88,
      "attribute_score": 0.95,
      "confidence_score": 0.92,
      "decision": "accepted"
    }
  ],
  "total": 234,
  "skip": 0,
  "limit": 100
}
```

#### GET /api/matches/{match_id}

Get a specific match by ID.

**Path Parameters:**
- `match_id` (string, required) - Match ID

**Response:**
```json
{
  "id": "match-1",
  "source_material_id": "1",
  "candidate_material_id": "2",
  "semantic_score": 0.92,
  "fuzzy_score": 0.88,
  "attribute_score": 0.95,
  "confidence_score": 0.92,
  "decision": "accepted",
  "source_material": {
    "id": "1",
    "material_code": "CPSE-A-001",
    "description": "Steel Plate 10mm"
  },
  "candidate_material": {
    "id": "2",
    "material_code": "CPSE-B-002",
    "description": "Steel Sheet 10mm"
  }
}
```

#### POST /api/matches/{match_id}/accept

Accept a material match.

**Path Parameters:**
- `match_id` (string, required) - Match ID

**Response:**
```json
{
  "id": "match-1",
  "status": "accepted",
  "message": "Match accepted successfully"
}
```

#### POST /api/matches/{match_id}/reject

Reject a material match.

**Path Parameters:**
- `match_id` (string, required) - Match ID

**Response:**
```json
{
  "id": "match-1",
  "status": "rejected",
  "message": "Match rejected successfully"
}
```

### Review

#### GET /api/review/queue

Get review queue.

**Query Parameters:**
- `skip` (integer, default: 0) - Number of records to skip
- `limit` (integer, default: 100) - Number of records to return
- `priority` (string, optional) - Filter by priority (high, medium, low)
- `status` (string, optional) - Filter by status (pending, completed)

**Response:**
```json
{
  "items": [
    {
      "id": "review-1",
      "match_id": "match-3",
      "source_material_id": "4",
      "candidate_material_id": "5",
      "priority": "high",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "assigned_to": "user-1"
    }
  ],
  "total": 42,
  "skip": 0,
  "limit": 100
}
```

#### GET /api/review/{review_id}

Get a specific review item by ID.

**Path Parameters:**
- `review_id` (string, required) - Review ID

**Response:**
```json
{
  "id": "review-1",
  "match_id": "match-3",
  "source_material_id": "4",
  "candidate_material_id": "5",
  "priority": "high",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z",
  "assigned_to": "user-1",
  "match_details": {
    "id": "match-3",
    "semantic_score": 0.88,
    "fuzzy_score": 0.85,
    "attribute_score": 0.92,
    "confidence_score": 0.88
  }
}
```

#### POST /api/review/{review_id}/decision

Submit review decision.

**Path Parameters:**
- `review_id` (string, required) - Review ID

**Request Body:**
```json
{
  "decision": "accept",
  "notes": "Materials are compatible"
}
```

**Response:**
```json
{
  "id": "review-1",
  "decision": "accept",
  "message": "Decision submitted successfully"
}
```

### Analytics

#### GET /api/analytics/dashboard

Get dashboard metrics.

**Response:**
```json
{
  "total_materials": 1250,
  "total_cpse": 5,
  "standardized_materials": 890,
  "harmonized_groups": 156,
  "pending_reviews": 42,
  "high_confidence_matches": 234,
  "duplicate_candidates": 89,
  "data_quality_score": 87,
  "processing_progress": 71
}
```

#### GET /api/analytics/cpse

Get CPSE analytics.

**Response:**
```json
{
  "cpse_data": [
    {
      "id": "CPSE-A",
      "name": "CPSE A - Northern Region",
      "location": "North Zone",
      "material_count": 450,
      "standardization_progress": 85
    }
  ]
}
```

#### GET /api/analytics/data-quality

Get data quality metrics.

**Response:**
```json
{
  "quality_metrics": {
    "completeness": 92,
    "consistency": 88,
    "accuracy": 85,
    "overall_score": 87
  }
}
```

#### GET /api/analytics/procurement

Get procurement insights.

**Response:**
```json
{
  "insights": [
    {
      "id": "proc-1",
      "common_code": "CM-001",
      "standardized_description": "Steel Plate 10mm",
      "total_demand": 50000,
      "total_volume": 500000,
      "cpse_count": 5,
      "consolidation_opportunity": 15,
      "potential_savings": 75000
    }
  ]
}
```

#### GET /api/analytics/evaluation

Get evaluation metrics.

**Response:**
```json
{
  "evaluation_metrics": {
    "precision": 0.92,
    "recall": 0.88,
    "f1_score": 0.90,
    "accuracy": 0.89
  }
}
```

### Ingestion

#### POST /api/ingest/upload

Upload dataset for ingestion.

**Request:** multipart/form-data with file

**Response:**
```json
{
  "filename": "CPSE_Material_Master.csv",
  "status": "uploaded",
  "file_id": "file-123",
  "message": "Dataset uploaded successfully"
}
```

#### POST /api/ingest/validate

Validate dataset before ingestion.

**Request:** multipart/form-data with file

**Response:**
```json
{
  "filename": "CPSE_Material_Master.csv",
  "valid": true,
  "errors": [],
  "warnings": [
    "5 materials have missing manufacturer information"
  ],
  "row_count": 1250,
  "message": "Dataset validation completed"
}
```

#### POST /api/ingest/process

Start dataset processing pipeline.

**Request Body:**
```json
{
  "file_id": "file-123",
  "config": {
    "skip_profiling": false,
    "skip_cleaning": false,
    "auto_accept_threshold": 0.90
  }
}
```

**Response:**
```json
{
  "job_id": "job-123",
  "status": "started",
  "estimated_duration": "15 minutes",
  "message": "Pipeline started successfully"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}
```

### Common Error Codes

- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Validation Error` - Request validation failed
- `500 Internal Server Error` - Server error

## Rate Limiting

- **Default:** 100 requests per minute
- **Authenticated:** 1000 requests per minute
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Pagination

All list endpoints support pagination:

- `skip` - Number of records to skip
- `limit` - Number of records to return (max: 1000)

Response includes:
- `total` - Total number of records
- `skip` - Current skip value
- `limit` - Current limit value

## Filtering

Most list endpoints support filtering via query parameters. Filter names and values are endpoint-specific.

## Sorting

Sorting is supported via query parameters:

- `sort_by` - Field to sort by
- `sort_order` - `asc` or `desc` (default: `asc`)

## Webhooks

Webhooks can be configured for real-time notifications:

- **Job Completion:** Notified when processing jobs complete
- **Review Assignment:** Notified when review items are assigned
- **Match Updates:** Notified when match decisions are made

Configure webhooks via the settings endpoint (to be implemented).
