import json
from pydantic import BaseModel
from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_sql_llm
from src.agents.schema_resolver import ResolvedSchema

class QueryPlan(BaseModel):
    reasoning: str
    sql: str
    chart_type: str

def generate_sql_plan(question: str, intent: str, resolved_schema: 'ResolvedSchema', history: list[dict]) -> QueryPlan:
    llm = get_sql_llm()
    
    # Format history
    history_str = ""
    for msg in history[-6:]: # last 3 turns
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_str += f"{role.capitalize()}: {content}\n"
        
    relevant_cols_str = "\n".join([f"- {c['column_name']}: {c['description']}" for c in resolved_schema.relevant_columns])
    
    prompt = PromptTemplate.from_template(
        "You are an expert SQLite developer and senior data analyst.\n"
        "You are the SQL planner for a business analytics tool.\n\n"
        "═══ DATABASE ═══\n"
        "There is EXACTLY ONE table: `{table_name}`\n"
        "Schema:\n{schema}\n\n"
        "Column Descriptions (semantic match):\n{relevant_cols}\n\n"
        "═══ CONTEXT ═══\n"
        "Conversation History:\n{history}\n"
        "User Question: {question}\n"
        "Detected Intent: {intent}\n\n"
        "═══ RULES ═══\n"
        "1. ONLY query `{table_name}`. NEVER invent tables like 'transactions', 'customers', etc.\n"
        "2. ONLY use columns that exist in the schema above. No guessing.\n"
        "3. Use SQLite-compatible syntax only.\n"
        "4. For aggregations, always include a GROUP BY and ORDER BY for clarity.\n"
        "5. LIMIT results to 20 rows max unless the user asks for all.\n"
        "6. Use meaningful column aliases (e.g., AS total_amount, AS avg_balance).\n"
        "7. CRITICAL: SQLite is CASE-SENSITIVE. Always use LOWER() for text comparisons.\n"
        "   e.g. WHERE LOWER(company_name) = LOWER('AlgoWorks') instead of WHERE company_name = 'AlgoWorks'.\n"
        "   Apply this to ALL WHERE, HAVING, and LIKE clauses that filter on text columns.\n\n"
        "═══ CHART SELECTION GUIDE ═══\n"
        "Choose the chart_type that best fits the data shape:\n"
        " • 'bar'  → comparing categories (GROUP BY with aggregate)\n"
        " • 'line' → trends over time (date/month in one axis)\n"
        " • 'pie'  → proportions of a whole (≤8 categories)\n"
        " • 'table' → raw data, lists, or details\n"
        " • 'none' → simple scalar answer (count, sum, avg)\n\n"
        "═══ OUTPUT ═══\n"
        "Output ONLY a valid JSON object (no markdown):\n"
        "{{\n"
        '  "reasoning": "2-3 sentence thought process",\n'
        '  "sql": "SELECT ...",\n'
        '  "chart_type": "bar|line|pie|table|none"\n'
        "}}\n"
    )
    
    chain = prompt | llm
    
    res = chain.invoke({
        "table_name": resolved_schema.table_name,
        "schema": resolved_schema.full_schema_str,
        "relevant_cols": relevant_cols_str,
        "history": history_str,
        "question": question,
        "intent": intent
    })
    
    content = res.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        parsed = json.loads(content)
        raw_sql = parsed.get("sql") or ""  # Guard against null/None from LLM
        return QueryPlan(
            reasoning=parsed.get("reasoning", ""),
            sql=str(raw_sql).strip() if raw_sql else "",
            chart_type=parsed.get("chart_type", "table")
        )
    except json.JSONDecodeError:
        # Fallback if invalid JSON
        return QueryPlan(
            reasoning="Failed to parse JSON from LLM.",
            sql="",
            chart_type="none"
        )
