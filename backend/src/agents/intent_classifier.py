from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_narrator_llm

VALID_INTENTS = ["aggregation", "comparison", "breakdown", "trend", "anomaly", "follow_up", "general"]

def classify_intent(question: str) -> str:
    prompt = PromptTemplate.from_template(
        "You are an intent classifier for a data analytics platform.\n"
        "Classify the user's question into EXACTLY ONE of the following categories:\n"
        "- aggregation: computing a total, average, min, max without grouping (e.g. 'total revenue')\n"
        "- comparison: comparing two or more specific items (e.g. 'sales in North vs South')\n"
        "- breakdown: grouping by a dimension (e.g. 'revenue by region')\n"
        "- trend: behavior over time (e.g. 'sales over the last 12 months')\n"
        "- anomaly: finding outliers or anomalies (e.g. 'any weird spikes in traffic?')\n"
        "- follow_up: a question that relies on context from previous questions (e.g. 'filter that by US')\n"
        "- general: anything else, chit-chat, or ambiguous questions.\n\n"
        "Question: {question}\n"
        "Category:"
    )
    
    llm = get_narrator_llm()
    chain = prompt | llm
    
    res = chain.invoke({"question": question})
    ans = res.content.strip().lower()
    
    for intent in VALID_INTENTS:
        if intent in ans:
            return intent
            
    return "general"
