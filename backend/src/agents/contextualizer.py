from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_narrator_llm

def contextualize_question(question: str, history: list[dict]) -> str:
    if not history:
        return question
        
    # Format history for the LLM
    history_str = ""
    for msg in history[-6:]: # last 3 turns
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_str += f"{role.capitalize()}: {content}\n"
        
    prompt = PromptTemplate.from_template(
        "Given the following conversation history and a follow-up question, "
        "rephrase the follow-up question to be a standalone question that can be understood without context.\n\n"
        "═══ HISTORY ═══\n"
        "{history}\n\n"
        "═══ FOLLOW-UP ═══\n"
        "{question}\n\n"
        "Standalone Question:"
    )
    
    llm = get_narrator_llm()
    chain = prompt | llm
    
    try:
        res = chain.invoke({
            "history": history_str,
            "question": question
        })
        standalone = res.content.strip()
        # If the LLM failed or just repeated, return original
        if not standalone or len(standalone) < 2:
            return question
        return standalone
    except Exception:
        return question
