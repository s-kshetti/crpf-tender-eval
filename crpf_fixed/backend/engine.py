# engine.py — Evaluation verdict engine
# Works with output from value_extractor.py (Groq-based)

CONFIDENCE_THRESHOLD = 0.75

class EvaluationEngine:
    def evaluate(self, criterion: dict, extraction: dict) -> dict:
        """
        Takes a criterion and an extraction result.
        Returns: { verdict, reason, confidence }
        """
        confidence = extraction.get("confidence", 0.0)

        # Rule 1: Low confidence → always Manual Review (never auto-reject)
        if confidence < CONFIDENCE_THRESHOLD:
            return {
                "verdict": "MANUAL_REVIEW",
                "reason": (
                    f"Confidence {confidence:.2f} is below required threshold {CONFIDENCE_THRESHOLD}. "
                    f"Reason: {extraction.get('reason', 'Unclear extraction.')}"
                ),
                "confidence": confidence,
            }

        # Rule 2: No value found → Manual Review
        if extraction.get("value") is None:
            return {
                "verdict": "MANUAL_REVIEW",
                "reason": "Required document or value was not found in the bidder submission.",
                "confidence": confidence,
            }

        # Rule 3: Numeric threshold comparison (financial / technical)
        threshold = criterion.get("threshold")
        numeric   = extraction.get("value_numeric")

        if threshold is not None and numeric is not None:
            if numeric >= threshold:
                return {
                    "verdict": "ELIGIBLE",
                    "reason": (
                        f"Extracted value '{extraction['value']}' meets the required "
                        f"threshold of {threshold:,} {criterion.get('unit') or ''}. "
                        f"Confidence: {confidence:.2f}."
                    ),
                    "confidence": confidence,
                }
            else:
                return {
                    "verdict": "NOT_ELIGIBLE",
                    "reason": (
                        f"Extracted value '{extraction['value']}' does NOT meet the required "
                        f"threshold of {threshold:,} {criterion.get('unit') or ''}."
                    ),
                    "confidence": confidence,
                }

        # Rule 4: Presence check (certification / compliance)
        if extraction.get("value"):
            return {
                "verdict": "ELIGIBLE",
                "reason": (
                    f"Required document/certificate found: {extraction['value']}. "
                    f"Confidence: {confidence:.2f}."
                ),
                "confidence": confidence,
            }

        # Fallback
        return {
            "verdict": "MANUAL_REVIEW",
            "reason": "Could not determine verdict from available evidence.",
            "confidence": 0.0,
        }

    def overall_verdict(self, criterion_results: list) -> str:
        """
        Logic:
        - If ANY mandatory criterion is NOT_ELIGIBLE → overall NOT_ELIGIBLE
        - If ANY criterion is MANUAL_REVIEW → overall MANUAL_REVIEW
        - Otherwise → ELIGIBLE
        """
        verdicts = [r["verdict"] for r in criterion_results]
        if "NOT_ELIGIBLE" in verdicts:
            return "NOT_ELIGIBLE"
        if "MANUAL_REVIEW" in verdicts:
            return "MANUAL_REVIEW"
        return "ELIGIBLE"
