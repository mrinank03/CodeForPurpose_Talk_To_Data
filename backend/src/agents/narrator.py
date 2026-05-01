import json
from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_narrator_llm
from src.utils.chart_advisor import recommend_chart_type

def narrate_result(question: str, data: list[dict], column_names: list[str], initial_chart_type: str) -> tuple[str, str, float]:
    if not data:
        return "No data to narrate.", "none", 0.5
        
    # Verify chart type
    confirmed_chart_type = initial_chart_type
    if confirmed_chart_type == "none" or confirmed_chart_type == "table":
        recom = recommend_chart_type(data, column_names)
        if recom != "table":
            confirmed_chart_type = recom
            
    # Sample data to prevent blowing up context
    sample_data = data[:10]
    
    prompt = PromptTemplate.from_template(
        "You are a business analyst writing for non-technical users. \n"
        "User Question: {question}\n"
        "Data Result (sample):\n{data}\n\n"
        "Write a 1–3 sentence plain-English summary of what the data shows. "
        "No jargon. Do not mention SQL or technical terms. Be specific with numbers. "
        "Do not format with Markdown headers."
    )
    
    llm = get_narrator_llm()
    chain = prompt | llm
    res = chain.invoke({"question": question, "data": json.dumps(sample_data)})
    
    narration = res.content.strip()
    
    # Grounding check
    grounding_prompt = PromptTemplate.from_template(
        "You are an exact factual verifier.\n"
        "Data Result (sample):\n{data}\n\n"
        "Claim/Narration:\n{narration}\n\n"
        "Extract up to 3 atomic claims from the narration (especially 'highest', 'lowest', totals, percentages, or exact numbers).\n"
        "Verify each against the data.\n"
        "If ALL claims are fully supported by the data, output EXACTLY AND ONLY 'SUPPORTED'.\n"
        "If ANY claim is false or cannot be verified from the data, output EXACTLY AND ONLY 'UNSUPPORTED'."
    )
    
    grounding_chain = grounding_prompt | llm
    grounding_res = grounding_chain.invoke({"data": json.dumps(sample_data), "narration": narration})
    grounding_output = grounding_res.content.strip().upper()
    
    if "UNSUPPORTED" in grounding_output:
        grounding_score = 0.0
    else:
        grounding_score = 1.0
        
    return narration, confirmed_chart_type, grounding_score
