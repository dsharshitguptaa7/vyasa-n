# VYASA-N — ENDPOINT REFERENCE & SCHEMAS

**Audit Date:** November 7, 2026  
**Auditor Classification:** Technical Lead & API Specialist  

---

## 1. Authentication Endpoint Schemas

### `POST /api/auth/login`
Authenticates a user identity and initiates session or challenge workflows.

#### Request Body (`LoginPayload`):
```json
{
  "email": "dean.rnd@csjmu.ac.in",
  "password": "SecurePassword123!"
}
```

#### Successful Response (`TokenResponse` - Direct Applicant Login):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "expires_in": 3600,
  "requires_password_change": false,
  "requires_two_factor": false,
  "two_factor_setup_required": false,
  "challenge_id": null
}
```

#### Successful Response (`TokenResponse` - Authority Requiring 2FA):
```json
{
  "access_token": null,
  "token_type": "bearer",
  "expires_in": 300,
  "requires_password_change": false,
  "requires_two_factor": true,
  "two_factor_setup_required": false,
  "challenge_id": "a3b8e5c1-9f2d-4e7a-8b1c-3d4e5f6a7b8c",
  "message": "Please enter the 6-digit verification code from your authenticator app."
}
```

#### Error Responses:
- `401 Unauthorized`: `{"success": false, "message": "Invalid email or password"}`
- `403 Forbidden`: `{"success": false, "message": "Account is deactivated. Please contact an administrator."}`
- `429 Too Many Requests`: `{"success": false, "message": "Too many failed login attempts. Please try again in 15 minutes."}`

---

## 2. Atharva Veda / NIVARAN Endpoint Schemas

### `POST /api/modules/atharva-veda/nivaran/grievances`
Submits a formal grievance docket.

#### Request Body (`GrievanceCreateRequest`):
```json
{
  "subject_id": "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e",
  "category_id": "c2d3e4f5-a6b7-8c9d-0e1f-2a3b4c5d6e7f",
  "title": "Discrepancy in Ph.D. Coursework Grade Card",
  "description": "The grade sheet issued for Paper-II Research Methodology reflects an absence despite signing the attendance register on October 14, 2026."
}
```

#### Response (`ApiResponse[GrievanceResponse]`):
```json
{
  "success": true,
  "message": "Grievance submitted successfully",
  "data": {
    "id": "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
    "tracking_id": "NIV-2026-84920",
    "status": "SUBMITTED",
    "priority": "MEDIUM",
    "subject_name": "Computer Science & Engineering",
    "category_name": "Coursework & Evaluation Discrepancy",
    "submitted_at": "2026-11-07T09:30:00Z"
  }
}
```

---

### `POST /api/modules/atharva-veda/nivaran/committees/polls/{poll_id}/vote`
Casts a cryptographically hashed ballot in a statutory committee poll.

#### Request Body (`CommitteePollVoteRequest`):
```json
{
  "option_id": "f7a8b9c0-d1e2-3f4a-5b6c-7d8e9f0a1b2c"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Ballot cast successfully",
  "data": {
    "poll_id": "d1e23f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
    "vote_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "cast_at": "2026-11-07T09:45:12Z"
  }
}
```

#### Error Responses:
- `400 Bad Request`: `{"success": false, "message": "Poll is closed or has expired."}`
- `409 Conflict`: `{"success": false, "message": "You have already cast a ballot in this poll."}`
- `403 Forbidden`: `{"success": false, "message": "Caller is not an active appointed member of this committee."}`

---

## 3. Public Ph.D. RAG Endpoint Schemas

### `POST /api/public/phd-admission/chat`
Answers applicant admissions questions grounded in official university documents.

#### Request Body (`ChatQueryRequest`):
```json
{
  "query": "What is the minimum passing grade required in Ph.D. Coursework according to the 2024-25 ordinance?",
  "conversation_history": [
    {"role": "user", "content": "Hello, I am preparing for admissions."},
    {"role": "assistant", "content": "Welcome to CSJMU! How can I guide you regarding Ph.D. admissions or regulations?"}
  ]
}
```

#### Response (`ChatQueryResponse`):
```json
{
  "answer": "According to Section 7.2 of the CSJMU Ph.D. Ordinance (2024-25), a doctoral scholar must obtain a minimum of 55% marks or an equivalent grade (Grade B) in the coursework examination to remain eligible for thesis registration.",
  "is_grounded": true,
  "citations": [
    {
      "document_name": "Ph.D. Ordinance CSJMU FINAL 2024-25",
      "section": "Section 7: Course Work & Evaluation",
      "page_number": 14,
      "relevance_score": 0.89
    }
  ],
  "disclaimer": "This information is grounded strictly in approved CSJMU Ph.D. regulatory documents."
}
```

#### Error Responses:
- `400 Bad Request`: `{"detail": "Query must contain at least 2 characters."}`
- `429 Too Many Requests`: `{"detail": "Rate limit exceeded. Maximum 20 queries permitted per minute. Please retry in 42 seconds."}`
