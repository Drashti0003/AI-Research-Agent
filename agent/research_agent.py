# agent/research_agent.py

import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing from .env")

client = Groq(api_key=GROQ_API_KEY)
MODEL = "openai/gpt-oss-20b"

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "gu": "Gujarati",
}


def research_question(question, language="en", history=None):
    """Research a question using Groq browser search and return answer plus sources."""
    question = (question or "").strip()
    if not question:
        return {
            "success": False,
            "error": "Please enter a research question.",
            "answer": "",
            "search_query": "",
            "sources": [],
        }

    language_name = LANGUAGE_NAMES.get(language, "English")
    history = history or []

    system_prompt = f"""
You are ResearchAI, a careful AI research assistant.
Use browser search to research the user's current question.
Answer in {language_name}, using natural, easy-to-understand language.
Keep technical terms in English when that improves clarity, and explain them
in the selected language. Never claim to be a doctor or give a diagnosis.
Use reliable sources, distinguish facts from uncertainty, and do not invent
citations or URLs. Keep the report concise and useful.
Use clear headings appropriate for the selected language. Include:
- Overview
- Key findings
- Explanation
- Limitations or cautions (when relevant)
- Conclusion
Aim for about 300-500 words, unless the question needs less.
"""

    messages = [{"role": "system", "content": system_prompt}]

    # Include a bounded amount of earlier conversation to support follow-up questions.
    for turn in history[-5:]:
        old_question = str(turn.get("question") or "").strip()
        old_answer = str(turn.get("answer") or "").strip()
        if old_question:
            messages.append({"role": "user", "content": old_question[:1200]})
        if old_answer:
            messages.append({"role": "assistant", "content": old_answer[:1800]})

    messages.append({
        "role": "user",
        "content": f"Research question: {question[:3000]}\nAnswer in {language_name}.",
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=[{"type": "browser_search"}],
            tool_choice="required",
            max_completion_tokens=1200,
            reasoning_effort="low",
        )

        message = response.choices[0].message
        answer = message.content or ""
        response_data = response.model_dump()
        sources = []
        seen_urls = set()

        def extract_sources(value):
            if isinstance(value, dict):
                url = value.get("url")
                if isinstance(url, str) and url.startswith(("https://", "http://")):
                    if url not in seen_urls:
                        seen_urls.add(url)
                        sources.append({
                            "title": str(value.get("title") or "Web Source"),
                            "url": url,
                        })
                for child in value.values():
                    extract_sources(child)
            elif isinstance(value, list):
                for child in value:
                    extract_sources(child)

        extract_sources(response_data)

        return {
            "success": bool(answer.strip()),
            "answer": answer.strip(),
            "search_query": question,
            "sources": sources,
        }

    except Exception as error:
        print("Research Agent Error:", repr(error))
        raise
