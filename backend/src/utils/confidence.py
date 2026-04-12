from enum import Enum

class ConfidenceLevel(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

def determine_confidence(intent_type: str, exact_match_found: bool) -> ConfidenceLevel:
    if intent_type == "general":
        return ConfidenceLevel.LOW
    if exact_match_found:
        return ConfidenceLevel.HIGH
    return ConfidenceLevel.MEDIUM
