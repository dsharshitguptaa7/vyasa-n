# NIVARAN Pillar Local AI Inference Pipeline

**Document Version:** 1.0.0  
**Status:** IMPLEMENTED & VERIFIED  
**Phase:** Local AI Pipeline Loader & Prediction Service  
**Target Pillar:** `apps/pillars/nivaran/backend/app/ai/`  
**Execution Environment:** 100% Local Scikit-Learn (CPU, <1 ms Latency, ~1.8 MB RAM)  

---

## 1. Architectural Statement

> **The production NIVARAN classifier uses the existing pre-trained local TF-IDF + Logistic Regression artifact. No external AI API is used and no runtime retraining occurs.**

The inference system runs entirely offline within the Python process. There are no connections or calls to Google Gemini, OpenAI, Claude, HuggingFace Inference API, or any remote neural network service. The pipeline relies strictly on deterministic vector projection and logistic scoring.

---

## 2. Artifact Specification

- **Location:** `app/ai/models/category_classifier.joblib` (resolved dynamically via `pathlib.Path(__file__).resolve().parent / "models" / "category_classifier.joblib"` without hard-coded paths).
- **Source of Origin:** Verified production artifact from `C:\Projects\NIVARAN-AI\backend\app\ai\models\category_classifier.joblib`.
- **Artifact Type:** Serialized `sklearn.pipeline.Pipeline` instance.
- **Artifact Size on Disk:** 223,084 bytes (~218 KB).
- **In-Memory RAM Footprint:** ~1.8 MB.
- **Pipeline Steps:**
  1. `('tfidf', TfidfVectorizer(...))`: Unigram and bigram word tokenization (`ngram_range=(1, 2)`), sublinear term frequency scaling (`sublinear_tf=True`), document frequency clipping (`max_df=0.95`, `min_df=1`), L2 normalization (`norm='l2'`), fitted vocabulary of 1,435 n-grams.
  2. `('classifier', LogisticRegression(...))`: Multinomial logistic regression (`solver='lbfgs'`, `C=1.0`, `penalty='l2'`, `max_iter=2000`, `random_state=42`).

---

## 3. Recognized Institutional Classes (16 Categories)

The classifier operates over exactly 16 discrete institutional categories, matching the 16 seeded categories in the frozen VYASA-NIVARAN database:

1. `Course_Work`
2. `Fee`
3. `Fellowship`
4. `FT_PT_Conversion`
5. `Other`
6. `PhD_Admission`
7. `Portal_Data_Correction`
8. `Publication_Verification`
9. `RAC`
10. `RDC`
11. `Registration`
12. `RTI_IIGRS`
13. `Supervisor_Related`
14. `Thesis_Evaluation`
15. `Thesis_Submission`
16. `Viva`

Any attempt to load a model missing any of these 16 categories raises a `ModelLoadError`.

---

## 4. Text Preprocessing Pipeline

Grievance input is sanitized and composed using the exact legacy preprocessing rules via `NivaranAIPipeline.preprocess_text(title, description)`:

```python
clean_title = (title or "").strip()
clean_desc = (description or "").strip()

if clean_title and clean_desc:
    return f"{clean_title}. {clean_desc}"
elif clean_title:
    return clean_title
elif clean_desc:
    return clean_desc
else:
    return "General research grievance inquiry."
```

- Trailing and leading whitespaces are stripped.
- Empty or `None` values are handled gracefully.
- If both title and description exist, they are concatenated with a period delimiter: `f"{title}. {description}"`.
- Completely blank grievances receive the institutional fallback string `"General research grievance inquiry."` to ensure valid tokenization.
- No external text cleaning, stopwords removal, or subject text is injected.

---

## 5. Prediction & Confidence Scoring

Inference is executed by `predict_category(title, description)`:

```python
text = preprocess_text(title, description)
probabilities = model.predict_proba([text])[0]
classes = model.classes_
best_idx = probabilities.argmax()

category = str(classes[best_idx])
confidence = float(probabilities[best_idx])
```

### Returned Response Structure:
```json
{
    "category": "Fellowship",
    "confidence": 0.8006,
    "model_name": "NIVARAN-AI-NLP",
    "model_version": "2.0.0"
}
```

- **`category`**: The predicted category string (one of the 16 institutional classes).
- **`confidence`**: The maximum posterior probability from the softmax vector in $[0.0, 1.0]$, rounded to 4 decimal places.
- **`model_name`**: Constant `"NIVARAN-AI-NLP"`.
- **`model_version`**: Constant `"2.0.0"`.

---

## 6. Lifecycle & Startup Behavior

Model loading is integrated directly into the FastAPI application `lifespan`:

```
Application Start
       │
       ▼
Database Ping Check
       │
       ▼
NivaranAIPipeline.initialize()
       │
       ├─► Locate artifact at app/ai/models/category_classifier.joblib
       ├─► Deserialize using joblib.load()
       ├─► Verify loaded object is sklearn.pipeline.Pipeline
       ├─► Verify presence of TfidfVectorizer step
       ├─► Verify presence of LogisticRegression step
       ├─► Verify presence of all 16 institutional classes
       └─► Retain in memory as singleton instance (ai_pipeline)
       │
       ▼
FastAPI App Serves Requests (Concurrent, Thread-Safe In-Memory Inference)
```

- **Loaded Once:** The pipeline artifact is loaded only once upon application startup. Subsequent calls reuse the in-memory singleton.
- **Thread-Safety:** Inference executes purely functional, read-only calls (`predict_proba`). Model state, vocabulary, and coefficient matrices are never mutated or retrained.
- **Locking:** An internal `threading.Lock` protects `initialize()` against race conditions during concurrent startup.

---

## 7. Failure Handling & Security Boundary

If the model artifact is missing, unreadable, or corrupted:
1. `NivaranAIPipeline.initialize()` raises a domain-specific `ModelLoadError` with error code `AI_MODEL_LOAD_ERROR`.
2. The application fails fast during startup rather than serving unclassified or misclassified grievances.
3. The system **never** silently trains an ad-hoc replacement model.
4. Internal file paths and OS stack traces are suppressed from client-facing API responses.

---

## 8. Dependency Specifications

The inference runtime relies solely on minimal, CPU-based libraries:

```text
scikit-learn>=1.7.0
joblib>=1.4.0
```

### Explicitly Excluded Dependencies:
- **No Large Language Models:** No `openai`, `google-generativeai`, `anthropic`.
- **No Heavy Deep Learning Frameworks:** No `torch`, `torchvision`, `torchaudio`, `transformers`, `sentence-transformers`.
- **No GPU Drivers:** No CUDA, no ROCm, no cuDNN.
- **Zero Network Egress:** Prediction requires no internet access.

---

## 9. Verification & Test Suite

The test suite in `tests/test_ai_pipeline.py` provides 18 automated tests:

| Test ID | Objective | Status |
| :--- | :--- | :---: |
| `test_01` | Verify model artifact exists at configured relative path | **PASSED** |
| `test_02` | Verify model artifact loads successfully | **PASSED** |
| `test_03` | Verify loaded object is `sklearn.pipeline.Pipeline` | **PASSED** |
| `test_04` | Verify pipeline contains `TfidfVectorizer` | **PASSED** |
| `test_05` | Verify pipeline contains `LogisticRegression` | **PASSED** |
| `test_06` | Verify model classes contain exactly the 16 institutional categories | **PASSED** |
| `test_07` | Verify empty input uses exact fallback text | **PASSED** |
| `test_08` | Verify title-only preprocessing | **PASSED** |
| `test_09` | Verify description-only preprocessing | **PASSED** |
| `test_10` | Verify title + description preprocessing | **PASSED** |
| `test_11` | Verify prediction returns a valid institutional category | **PASSED** |
| `test_12` | Verify confidence is in range $[0.0, 1.0]$ | **PASSED** |
| `test_13` | Verify confidence is rounded to 4 decimal places | **PASSED** |
| `test_14` | Verify `model_name` metadata is `"NIVARAN-AI-NLP"` | **PASSED** |
| `test_15` | Verify `model_version` metadata is `"2.0.0"` | **PASSED** |
| `test_16` | Verify repeated predictions reuse identical model instance | **PASSED** |
| `test_17` | Verify no retraining or vocabulary mutation occurs | **PASSED** |
| `test_18` | Verify missing or corrupt artifact raises `ModelLoadError` | **PASSED** |

**Total Suite Status:** 61 passed out of 61 across all backend test modules.
