import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid, time
from typing import List
sys.path.insert(0, os.path.dirname(__file__))
from processor import DocumentProcessor
from criteria_extractor import CriteriaExtractor
from value_extractor import ValueExtractor
from engine import EvaluationEngine

app = FastAPI(title="CRPF Tender Evaluation API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = {}
processor          = DocumentProcessor()
criteria_extractor = CriteriaExtractor()
value_extractor    = ValueExtractor()
engine             = EvaluationEngine()


@app.get("/")
def root():
    return {"status": "running", "service": "CRPF Tender Evaluation API"}


# ── Upload tender & extract criteria ─────────────────────────────────────────
@app.post("/api/tender/upload")
async def upload_tender(file: UploadFile = File(...)):
    content  = await file.read()
    run_id   = str(uuid.uuid4())[:8].upper()
    doc      = processor.process(content, file.filename)

    # Your criteria_extractor.extract() only takes tender_text
    criteria = criteria_extractor.extract(doc["text"])

    store[run_id] = {
        "run_id":          run_id,
        "tender_filename": file.filename,
        "doc_type":        doc["doc_type"],
        "criteria":        criteria,
        "bidders":         [],
        "created_at":      time.time(),
        "status":          "criteria_extracted",
    }

    return {
        "run_id":          run_id,
        "tender_filename": file.filename,
        "doc_type":        doc["doc_type"],
        "criteria_count":  len(criteria),
        "criteria":        criteria,
        "message":         f"Extracted {len(criteria)} eligibility criteria",
    }


# ── Get full run ──────────────────────────────────────────────────────────────
@app.get("/api/run/{run_id}")
def get_run(run_id: str):
    if run_id not in store:
        raise HTTPException(404, "Run not found")
    return store[run_id]


# ── Evaluate a bidder ─────────────────────────────────────────────────────────
@app.post("/api/run/{run_id}/bidder")
async def evaluate_bidder(
    run_id:      str,
    bidder_name: str               = Form(...),
    files:       List[UploadFile]  = File(...),
):
    if run_id not in store:
        raise HTTPException(404, "Run not found")

    run       = store[run_id]
    criteria  = run["criteria"]
    bidder_id = str(uuid.uuid4())[:6].upper()

    # Process all uploaded documents into one text blob
    all_text    = ""
    doc_details = []
    for f in files:
        content    = await f.read()
        doc_result = processor.process(content, f.filename)
        all_text  += f"\n\n[Document: {f.filename}]\n{doc_result['text']}"
        doc_details.append({
            "filename":   f.filename,
            "doc_type":   doc_result["doc_type"],
            "confidence": doc_result["confidence"],
        })

    # Evaluate each criterion
    # Your value_extractor.extract() takes (document_text, criterion) only
    criterion_results = []
    for criterion in criteria:
        try:
            extraction = value_extractor.extract(all_text, criterion)
        except Exception as e:
            # If Groq call fails, fall back to manual review
            extraction = {
                "value": None,
                "value_numeric": None,
                "confidence": 0.3,
                "page_reference": "",
                "reason": f"Extraction failed: {str(e)}",
                "source_document": doc_details[0]["filename"] if doc_details else "unknown",
            }

        verdict = engine.evaluate(criterion, extraction)

        criterion_results.append({
            "criterion_id":          criterion["id"],
            "criterion_description": criterion["description"],
            "criterion_type":        criterion["type"],
            "mandatory":             criterion["mandatory"],
            "threshold":             criterion.get("threshold"),
            "unit":                  criterion.get("unit"),
            "extracted_value":       extraction.get("value"),
            "extracted_numeric":     extraction.get("value_numeric"),
            "confidence":            extraction.get("confidence", 0.0),
            "source_document":       extraction.get("source_document",
                                         doc_details[0]["filename"] if doc_details else ""),
            "page_reference":        extraction.get("page_reference", ""),
            "extraction_reason":     extraction.get("reason", ""),
            "verdict":               verdict["verdict"],
            "verdict_reason":        verdict["reason"],
            "human_override":        None,
            "override_reason":       None,
        })

    overall = engine.overall_verdict(criterion_results)

    bidder_eval = {
        "bidder_id":         bidder_id,
        "bidder_name":       bidder_name,
        "documents":         doc_details,
        "criterion_results": criterion_results,
        "overall_verdict":   overall,
        "evaluated_at":      time.time(),
    }

    run["bidders"].append(bidder_eval)
    run["status"] = "evaluated"
    return bidder_eval


# ── Full report ───────────────────────────────────────────────────────────────
@app.get("/api/run/{run_id}/report")
def get_report(run_id: str):
    if run_id not in store:
        raise HTTPException(404, "Run not found")

    run     = store[run_id]
    bidders = run["bidders"]

    return {
        "run_id":          run_id,
        "tender_filename": run["tender_filename"],
        "criteria":        run["criteria"],
        "bidders":         bidders,
        "summary": {
            "total":         len(bidders),
            "eligible":      sum(1 for b in bidders if b["overall_verdict"] == "ELIGIBLE"),
            "not_eligible":  sum(1 for b in bidders if b["overall_verdict"] == "NOT_ELIGIBLE"),
            "manual_review": sum(1 for b in bidders if b["overall_verdict"] == "MANUAL_REVIEW"),
        },
        "status": run["status"],
    }


# ── Human override ────────────────────────────────────────────────────────────
@app.post("/api/run/{run_id}/bidder/{bidder_id}/override")
async def override_verdict(
    run_id:       str,
    bidder_id:    str,
    criterion_id: str = Form(...),
    new_verdict:  str = Form(...),
    reason:       str = Form(...),
):
    if run_id not in store:
        raise HTTPException(404, "Run not found")

    for bidder in store[run_id]["bidders"]:
        if bidder["bidder_id"] == bidder_id:
            for result in bidder["criterion_results"]:
                if result["criterion_id"] == criterion_id:
                    result["human_override"]  = new_verdict
                    result["override_reason"] = reason
                    effective = [
                        {"verdict": r["human_override"] or r["verdict"],
                         "mandatory": r["mandatory"]}
                        for r in bidder["criterion_results"]
                    ]
                    bidder["overall_verdict"] = engine.overall_verdict(effective)
                    return {"message": "Override saved",
                            "new_overall": bidder["overall_verdict"]}

    raise HTTPException(404, "Bidder or criterion not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
