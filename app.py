'''This is your Flask backend.

It receives requests from the frontend.

Example:

Frontend
   ↓
"What is AI?"
   ↓
app.py'''

from flask import Flask, render_template, request, jsonify
import json
import re
import uuid

from agent.research_agent import research_question

from database.history import (
    initialize_database,
    save_research,
    get_history,
    get_conversation,
    get_research,  # Added this missing import
    delete_research,
    delete_all_history,
    delete_conversation_turns_from,
)


app = Flask(__name__)
initialize_database()

SUPPORTED_LANGUAGES = {"en", "hi", "gu"}



def friendly_error(error):
    """Show clear, user-friendly error messages."""

    message = str(error).lower()

    if "context_length" in message or "reduce the length" in message:
        return (
            "This conversation is too long. "
            "Please start a new chat or ask a shorter question."
        )

    if "rate_limit" in message or "rate limit" in message or "429" in message:
        return (
            "The AI service is busy right now. "
            "Please wait a moment and try again."
        )

    if "authentication" in message or "api key" in message or "401" in message:
        return (
            "The research service could not authenticate. "
            "Please try again later."
        )

    if "timeout" in message or "connection" in message or "network" in message:
        return (
            "Could not connect to the research service. "
            "Please check your internet connection."
        )

    if "invalid" in message or "400" in message:
        return (
            "Your question could not be processed. "
            "Please rephrase it or try a shorter question."
        )

    return (
        "Sorry, I couldn't complete this research. "
        "Please try again with a different or shorter question."
    )



@app.route("/")
def home():
    return render_template("index.html")


@app.route("/conversations/new", methods=["POST"])
def new_conversation():
    return jsonify({"success": True, "conversation_id": uuid.uuid4().hex})


@app.route("/research", methods=["POST"])
def research():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question") or "").strip()
    language = str(data.get("language") or "en")
    conversation_id = str(data.get("conversation_id") or uuid.uuid4().hex)
    edit_turn_id = data.get("edit_turn_id")

    if not question:
        return jsonify({"success": False, "error": "Please enter a question before researching."}), 400

    if language not in SUPPORTED_LANGUAGES:
        language = "en"

    try:
        turns = get_conversation(conversation_id)
        prior_turns = turns

        # Editing a previous question replaces that turn and all later turns.
        if edit_turn_id is not None:
            try:
                edit_turn_id = int(edit_turn_id)
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": "That message cannot be edited. Please try again."}), 400

            found_index = next((i for i, turn in enumerate(turns) if int(turn["id"]) == edit_turn_id), None)
            if found_index is None:
                return jsonify({"success": False, "error": "That message is no longer in this conversation. Refresh history and try again."}), 404

            prior_turns = turns[:found_index]

        # Keep the context bounded. Research agent also truncates old answer text.
        context = []
        for turn in prior_turns[-6:]:
            context.append({
                "question": turn.get("question", ""),
                "answer": turn.get("answer", ""),
            })

        result = research_question(question, language=language, history=context)
        answer = result.get("answer") or ""
        sources = result.get("sources") or []

        if result.get("success") is False or not answer:
            return jsonify({
                "success": False,
                "error": result.get("error") or "The research service did not return an answer."
            }), 502

        # Only replace old turns after the new answer was generated successfully.
        # This preserves the original conversation if the model/API call fails.
        if edit_turn_id is not None:
            delete_conversation_turns_from(conversation_id, edit_turn_id)

        saved_id = save_research(
            question=question,
            answer=answer,
            search_query=result.get("search_query", question),
            sources=sources,
            conversation_id=conversation_id,
            language=language,
        )

        conversation = get_conversation(conversation_id)
        for turn in conversation:
            try:
                turn["sources"] = json.loads(turn.get("sources") or "[]")
            except (TypeError, json.JSONDecodeError):
                turn["sources"] = []

        return jsonify({
            "success": True,
            "conversation_id": conversation_id,
            "saved_turn_id": saved_id,
            "answer": answer,
            "search_query": result.get("search_query", question),
            "sources": sources,
            "conversation": conversation,
        })

    except Exception as error:
        print("RESEARCH ERROR:", repr(error))
        return jsonify({"success": False, "error": friendly_error(error)}), 500


@app.route("/history", methods=["GET"])
def history():
    try:
        return jsonify({"success": True, "history": get_history()})
    except Exception as error:
        print("HISTORY ERROR:", repr(error))
        return jsonify({"success": False, "history": [], "error": "Could not load conversation history."}), 500


@app.route("/history/<path:conversation_id>", methods=["GET"])
def history_item(conversation_id):
    turns = get_conversation(conversation_id)
    if not turns:
        # Backwards compatibility: older history items used their row ID.
        try:
            old_record = get_research(int(conversation_id))
        except (ValueError, TypeError):
            old_record = None
        if old_record:
            turns = [old_record]

    if not turns:
        return jsonify({"success": False, "error": "Conversation not found."}), 404

    for turn in turns:
        try:
            turn["sources"] = json.loads(turn.get("sources") or "[]")
        except (TypeError, json.JSONDecodeError):
            turn["sources"] = []

    return jsonify({
        "success": True,
        "conversation_id": conversation_id,
        "conversation": turns,
    })


@app.route("/history/<int:research_id>", methods=["DELETE"])
def delete_one_history(research_id):
    try:
        delete_research(research_id)
        return jsonify({"success": True})
    except Exception as error:
        print("DELETE ERROR:", repr(error))
        return jsonify({"success": False, "error": "Could not delete that history item."}), 500


@app.route("/history/clear", methods=["DELETE"])
def clear_history():
    try:
        delete_all_history()
        return jsonify({"success": True})
    except Exception as error:
        print("CLEAR HISTORY ERROR:", repr(error))
        return jsonify({"success": False, "error": "Could not clear history."}), 500


if __name__ == "__main__":
    app.run(debug=True)
