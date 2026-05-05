# backend/evaluator.py

CONFIDENCE_THRESHOLD = 0.75

class EvaluationEngine:
    def evaluate(self, criterion: dict, extraction: dict) -> dict:
        confidence = extraction.get("confidence", 0.0)

        # Low confidence → always manual review
        if confidence < CONFIDENCE_THRESHOLD:
            return {
                "verdict": "MANUAL_REVIEW",
                "reason": f"Confidence score {confidence:.2f} is below the required threshold of {CONFIDENCE_THRESHOLD}. Reason: {extraction.get('reason', 'Unclear extraction.')}",
                "confidence": confidence,
            }

        # Value not found
        if extraction.get("value") is None:
            return {
                "verdict": "MANUAL_REVIEW",
                "reason": "Required document or value could not be found in the bidder's submission.",
                "confidence": confidence,
            }

        # Numeric comparison (financial, technical count)
        threshold = criterion.get("threshold")
        numeric   = extraction.get("value_numeric")

        if threshold is not None and numeric is not None:
            if numeric >= threshold:
                return {
                    "verdict": "ELIGIBLE",
                    "reason": f"Extracted value {extraction['value']} meets the required threshold of {threshold:,} {criterion.get('unit') or ''}. Confidence: {confidence:.2f}.",
                    "confidence": confidence,
                }
            else:
                return {
                    "verdict": "NOT_ELIGIBLE",
                    "reason": f"Extracted value {extraction['value']} does not meet the required threshold of {threshold:,} {criterion.get('unit') or ''}.",
                    "confidence": confidence,
                }

        # Presence check (certifications, compliance)
        if extraction.get("value"):
            return {
                "verdict": "ELIGIBLE",
                "reason": f"Required document found: {extraction['value']}. Confidence: {confidence:.2f}.",
                "confidence": confidence,
            }

        return {
            "verdict": "MANUAL_REVIEW",
            "reason": "Could not determine verdict from available evidence.",
            "confidence": 0.0,
        }

    def overall_verdict(self, criterion_results: list) -> str:
        """
        NOT_ELIGIBLE if any mandatory criterion is NOT_ELIGIBLE.
        MANUAL_REVIEW if any criterion is MANUAL_REVIEW.
        ELIGIBLE only if all criteria pass.
        """
        verdicts = [r["verdict"] for r in criterion_results]
        if "NOT_ELIGIBLE" in verdicts:
            return "NOT_ELIGIBLE"
        if "MANUAL_REVIEW" in verdicts:
            return "MANUAL_REVIEW"
        return "ELIGIBLE"