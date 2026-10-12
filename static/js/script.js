// ResearchAI frontend: conversation history, language, voice and status handling.



const $ = (id) => document.getElementById(id);



const question = $("question");

const followupQuestion = $("followupQuestion");

const researchButton = $("researchButton");

const followupButton = $("followupButton");

const voiceButton = $("voiceButton");

const followupVoiceButton = $("followupVoiceButton");

const themeButton = $("themeButton");

const languageSelect = $("languageSelect");

const welcome = $("welcome");

const researchView = $("researchView");

const questionTitle = $("questionTitle");

const agentStatus = $("agentStatus");

const statusText = $("statusText");

const errorBanner = $("errorBanner");

const chatMessages = $("chatMessages");

const historyList = $("historyList");

const clearHistory = $("clearHistory");

const toast = $("toast");



let conversationId = null;

let isResearching = false;

let editingTurnId = null;

let activeRecognition = null;

let activeMicButton = null;

let speechActive = false;

let toastTimer = null;



const LANGUAGE_SETTINGS = {

    en: { recognition: "en-IN", speech: "en-IN", name: "English" },

    hi: { recognition: "hi-IN", speech: "hi-IN", name: "Hindi" },

    gu: { recognition: "gu-IN", speech: "gu-IN", name: "Gujarati" }

};



document.addEventListener("DOMContentLoaded", () => {

    loadTheme();

    loadHistory();

    setupExamples();

    setupEnterToSend();

    setupVoiceButtons();

});



function showToast(message) {

    toast.textContent = message;

    toast.classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);

}



function showError(message) {

    errorBanner.textContent = message;

    errorBanner.classList.remove("hidden");

}



function clearError() {

    errorBanner.textContent = "";

    errorBanner.classList.add("hidden");

}



function loadTheme() {

    const theme = localStorage.getItem("researchAITheme");

    document.body.classList.toggle("dark", theme === "dark");

    themeButton.textContent = theme === "dark" ? "☀️" : "🌙";

}



themeButton.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    const dark = document.body.classList.contains("dark");

    localStorage.setItem("researchAITheme", dark ? "dark" : "light");

    themeButton.textContent = dark ? "☀️" : "🌙";

});



function setupEnterToSend() {

    question.addEventListener("keydown", (event) => {

        if (event.key === "Enter" && !event.shiftKey) {

            event.preventDefault();

            performResearch(question.value, null, true);

        }

    });

    followupQuestion.addEventListener("keydown", (event) => {

        if (event.key === "Enter" && !event.shiftKey) {

            event.preventDefault();

            performResearch(followupQuestion.value, editingTurnId, false);

        }

    });

    $("researchButton").addEventListener("click", () => performResearch(question.value, null, true));

    followupButton.addEventListener("click", () => performResearch(followupQuestion.value, editingTurnId, false));

}



async function performResearch(rawQuestion, editId = null, fromWelcome = false) {

    const userQuestion = (rawQuestion || "").trim();

    if (!userQuestion) {

        showToast("Please enter a question before researching.");

        (fromWelcome ? question : followupQuestion).focus();

        return;

    }

    if (isResearching) {

        showToast("Please wait for the current research to finish.");

        return;

    }



    clearError();

    stopSpeaking();

    stopVoiceInput();

    isResearching = true;

    setBusy(true);



    if (fromWelcome) {

        welcome.classList.add("hidden");

        researchView.classList.remove("hidden");

        if (!conversationId) {

            try {

                const newResponse = await fetch("/conversations/new", { method: "POST" });

                const newData = await newResponse.json();

                if (!newResponse.ok || !newData.success) throw new Error("Could not start a new chat.");

                conversationId = newData.conversation_id;

            } catch (error) {

                showError(error.message || "Could not start a new chat. Please try again.");

                finishResearch();

                return;

            }

        }

    } else {

        researchView.classList.remove("hidden");

        welcome.classList.add("hidden");

        if (!conversationId) {

            try {

                const newResponse = await fetch("/conversations/new", { method: "POST" });

                const newData = await newResponse.json();

                if (!newResponse.ok || !newData.success) throw new Error("Could not start a new chat.");

                conversationId = newData.conversation_id;

            } catch (error) {

                showError(error.message || "Could not start a new chat. Please try again.");

                finishResearch();

                return;

            }

        }

    }



    if (fromWelcome) question.value = "";

    else followupQuestion.value = "";



    questionTitle.textContent = "Research conversation";

    agentStatus.classList.remove("hidden");

    statusText.textContent = editId ? "Updating your question and researching again…" : "Researching your question…";

    resetAgentSteps();

    updateStep("stepPlan", "active");

    updateStep("stepPlan", "completed");

    updateStep("stepSearch", "active");



    try {

        const response = await fetch("/research", {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

                question: userQuestion,

                language: languageSelect.value,

                conversation_id: conversationId,

                edit_turn_id: editId

            })

        });



        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {

            throw new Error(data.error || `Research failed (HTTP ${response.status}). Please try again.`);

        }



        conversationId = data.conversation_id || conversationId;

        updateStep("stepSearch", "completed");

        updateStep("stepAnalyze", "active");

        updateStep("stepAnalyze", "completed");

        updateStep("stepAnswer", "active");

        renderConversation(data.conversation || []);

        updateStep("stepAnswer", "completed");

        await loadHistory();

        editingTurnId = null;

        followupButton.textContent = "Send →";

    } catch (error) {

        showError(error.message || "Something went wrong. Please try again.");

    } finally {

        finishResearch();

    }

}



function setBusy(busy) {

    researchButton.disabled = busy;

    followupButton.disabled = busy;

    researchButton.innerHTML = busy ? "Researching…" : "Research <span>→</span>";

    followupButton.innerHTML = busy ? "Working…" : (editingTurnId ? "Regenerate ↻" : "Send <span>→</span>");

    voiceButton.disabled = busy;

    followupVoiceButton.disabled = busy;

}



function finishResearch() {

    isResearching = false;

    setBusy(false);

    agentStatus.classList.add("hidden");

    $("stepPlan").classList.remove("active");

    $("stepSearch").classList.remove("active");

    $("stepAnalyze").classList.remove("active");

    $("stepAnswer").classList.remove("active");

}



function resetAgentSteps() {

    ["stepPlan", "stepSearch", "stepAnalyze", "stepAnswer"].forEach((id) => updateStep(id, ""));

}



function updateStep(id, state) {

    const item = $(id);

    if (!item) return;

    item.classList.remove("active", "completed");

    const icon = item.querySelector("span");

    if (state === "active") {

        item.classList.add("active");

        if (icon) icon.textContent = "●";

    } else if (state === "completed") {

        item.classList.add("completed");

        if (icon) icon.textContent = "✓";

    } else if (icon) {

        icon.textContent = "○";

    }

}



function renderConversation(turns) {

    chatMessages.innerHTML = "";

    if (!turns.length) return;

    turns.forEach((turn) => {

        const wrapper = document.createElement("section");

        wrapper.className = "chat-turn";



        const userRow = document.createElement("div");

        userRow.className = "user-message-row";

        const userBubble = document.createElement("div");

        userBubble.className = "user-message";

        userBubble.textContent = turn.question || "";

        const editButton = document.createElement("button");

        editButton.className = "message-edit";

        editButton.type = "button";

        editButton.textContent = "Edit question";

        editButton.title = "Edit this question and regenerate the answer";

        editButton.addEventListener("click", () => beginEdit(turn));

        userRow.append(userBubble, editButton);



        const assistantCard = document.createElement("article");

        assistantCard.className = "assistant-message";

        const toolbar = document.createElement("div");

        toolbar.className = "message-toolbar";

        const label = document.createElement("span");

        label.className = "label";

        label.textContent = "RESEARCH ANSWER";

        const actions = document.createElement("div");

        actions.className = "answer-actions";



        const speak = document.createElement("button");

        speak.className = "small-action";

        speak.type = "button";

        speak.textContent = "🔊";

        speak.title = "Read answer aloud";

        speak.addEventListener("click", () => speakText(turn.answer || "", speak));



        const copy = document.createElement("button");

        copy.className = "small-action";

        copy.type = "button";

        copy.textContent = "📋";

        copy.title = "Copy answer";

        copy.addEventListener("click", async () => {

            try {

                await navigator.clipboard.writeText(turn.answer || "");

                showToast("Answer copied.");

            } catch {

                showToast("Could not copy. Check browser clipboard permissions.");

            }

        });

        actions.append(speak, copy);

        toolbar.append(label, actions);



        const answerBody = document.createElement("div");

        answerBody.className = "result";

        answerBody.innerHTML = formatAnswer(turn.answer || "");



        assistantCard.append(toolbar, answerBody);



        const sources = parseSources(turn.sources);

        if (sources.length) {

            const sourceSection = document.createElement("div");

            sourceSection.className = "sources-section";

            const heading = document.createElement("div");

            heading.className = "sources-title";

            heading.textContent = "🔗 Sources";

            sourceSection.appendChild(heading);

            sources.forEach((source) => {

                if (!source.url || !/^https?:\/\//i.test(source.url)) return;

                const item = document.createElement("div");

                item.className = "source-item";

                const link = document.createElement("a");

                link.href = source.url;

                link.target = "_blank";

                link.rel = "noopener noreferrer";

                link.textContent = source.title || source.url;

                item.appendChild(document.createTextNode("🔗 "));

                item.appendChild(link);

                sourceSection.appendChild(item);

            });

            assistantCard.appendChild(sourceSection);

        }



        wrapper.append(userRow, assistantCard);

        chatMessages.appendChild(wrapper);

    });

    chatMessages.scrollTop = chatMessages.scrollHeight;

}



function parseSources(value) {

    if (Array.isArray(value)) return value;

    if (typeof value === "string") {

        try { return JSON.parse(value); } catch { return []; }

    }

    return [];

}



function beginEdit(turn) {

    if (isResearching) return;

    editingTurnId = Number(turn.id);

    followupQuestion.value = turn.question || "";

    followupButton.innerHTML = "Regenerate ↻";

    followupQuestion.focus();

    showToast("Edit the question, then select Regenerate. Later turns will be replaced.");

    followupQuestion.scrollIntoView({ behavior: "smooth", block: "center" });

}



function formatAnswer(rawText) {
    let html = escapeHTML(rawText || "No answer received.");

    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/^\s*[-•] (.*)$/gm, "<li>$1</li>");
    html = html.replace(/(?:<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

    html = html.split(/\n{2,}/).map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return "";
        if (/^<(h[1-3]|ul|ol|blockquote|pre)\b/i.test(trimmed)) return trimmed;
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return html;
}

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = String(value);

    return div.innerHTML;

}



function selectedLanguage() {

    return LANGUAGE_SETTINGS[languageSelect.value] || LANGUAGE_SETTINGS.en;

}





function cleanTextForSpeech(rawText) {
    return String(rawText || "")
        .replace(/```[\s\S]*?```/g, "Code block omitted.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/^\s{0,3}#{1,6}\s*/gm, "")
        .replace(/^\s*>\s?/gm, "")
        .replace(/^\s*[-+*]\s+/gm, "")
        .replace(/^\s*\d+[.)]\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/~~(.*?)~~/g, "$1")
        .replace(/[>*_#~`]/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Text-to-speech. Pressing the same button again stops playback.

function speakText(text, button) {

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {

        showToast("Text-to-speech is not supported in this browser.");

        return;

    }

    if (speechActive && window.speechSynthesis.speaking) {

        stopSpeaking();

        return;

    }

    const cleanText = cleanTextForSpeech(text);

    if (!cleanText) return;

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = selectedLanguage().speech;

    utterance.rate = 0.95;

    utterance.pitch = 1;

    speechActive = true;

    if (button) button.textContent = "⏹";

    utterance.onend = () => {

        speechActive = false;

        if (button) button.textContent = "🔊";

    };

    utterance.onerror = () => {

        speechActive = false;

        if (button) button.textContent = "🔊";

        showToast("Could not read the answer aloud. Your browser may not have a voice for this language.");

    };

    window.speechSynthesis.speak(utterance);

}



function stopSpeaking() {

    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    speechActive = false;

    document.querySelectorAll(".message-toolbar .small-action").forEach((button) => {

        if (button.title === "Read answer aloud") button.textContent = "🔊";

    });

}



// Speech-to-text: Chrome/Edge Web Speech API.
function setupVoiceButtons() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        [voiceButton, followupVoiceButton].forEach((button) => {
            if (!button) return;
            button.addEventListener("click", () => {
                showToast(
                    "Voice input is not supported in this browser. Please use the latest Google Chrome or Microsoft Edge."
                );
            });
        });
        return;
    }

    function startRecognition(button, target) {
        if (!button || !target) {
            showToast("The microphone or input field could not be found. Refresh the page and try again.");
            return;
        }

        // Clicking the active microphone stops listening.
        if (activeRecognition) {
            if (activeMicButton === button) {
                stopVoiceInput();
                return;
            }
            stopVoiceInput();
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = selectedLanguage().recognition;
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            activeRecognition = recognition;
            activeMicButton = button;
            button.classList.add("listening");
            button.textContent = "⏹";
            button.title = "Stop voice input";

            recognition.onstart = () => {
                showToast(`Listening in ${selectedLanguage().name}. Speak now.`);
            };

            recognition.onresult = (event) => {
                const transcript =
                    event.results && event.results[0] && event.results[0][0]
                        ? event.results[0][0].transcript.trim()
                        : "";

                if (transcript) {
                    target.value = target.value.trim()
                        ? `${target.value.trim()} ${transcript}`
                        : transcript;
                    target.focus();
                } else {
                    showToast("No words were detected. Please try speaking again.");
                }
            };

            recognition.onerror = (event) => {
                const messages = {
                    "not-allowed":
                        "Microphone permission is blocked. Allow microphone access in your browser settings.",
                    "audio-capture":
                        "No microphone was detected. Check your microphone connection.",
                    "no-speech":
                        "No speech was detected. Please speak after clicking the microphone.",
                    "network":
                        "Voice recognition could not connect. Check your internet connection and try again.",
                    "service-not-allowed":
                        "Your browser blocked voice recognition. Try the latest Chrome or Edge.",
                    "language-not-supported":
                        `Voice recognition is not available for ${selectedLanguage().name} in this browser. Try English or change your browser's speech settings.`,
                    "aborted":
                        "Voice input was stopped."
                };
                showToast(
                    messages[event.error] ||
                    `Voice input failed (${event.error}). Check microphone permission and try again.`
                );
            };

            recognition.onend = () => {
                button.classList.remove("listening");
                button.textContent = "🎤";
                button.title = "Speak your question";
                if (activeRecognition === recognition) activeRecognition = null;
                if (activeMicButton === button) activeMicButton = null;
            };

            recognition.start();
        } catch (error) {
            button.classList.remove("listening");
            button.textContent = "🎤";
            button.title = "Speak your question";
            activeRecognition = null;
            activeMicButton = null;
            showToast("Could not start the microphone. Allow microphone access and try again.");
        }
    }

    if (voiceButton) {
        voiceButton.addEventListener("click", () => startRecognition(voiceButton, question));
    }

    if (followupVoiceButton) {
        followupVoiceButton.addEventListener("click", () =>
            startRecognition(followupVoiceButton, followupQuestion)
        );
    }
}

function stopVoiceInput() {
    const recognition = activeRecognition;
    const button = activeMicButton;

    activeRecognition = null;
    activeMicButton = null;

    if (button) {
        button.classList.remove("listening");
        button.textContent = "🎤";
        button.title = "Speak your question";
    }

    if (recognition) {
        recognition.onend = null;
        try {
            recognition.stop();
        } catch (error) {
            // It may already have stopped.
        }
    }
}

function startNewResearch() {

    stopSpeaking();

    stopVoiceInput();

    conversationId = null;

    editingTurnId = null;

    question.value = "";

    followupQuestion.value = "";

    chatMessages.innerHTML = "";

    clearError();

    agentStatus.classList.add("hidden");

    welcome.classList.remove("hidden");

    researchView.classList.add("hidden");

    followupButton.innerHTML = "Send <span>→</span>";

    question.focus();

}



$("newResearch").addEventListener("click", startNewResearch);

$("askAnother").addEventListener("click", startNewResearch);



function setupExamples() {

    document.querySelectorAll(".example-card").forEach((card) => {

        card.addEventListener("click", () => {

            question.value = card.dataset.question || "";

            performResearch(question.value, null, true);

        });

    });

}



async function loadHistory() {

    try {

        const response = await fetch("/history");

        const data = await response.json();

        if (!response.ok || !data.success) throw new Error(data.error || "Could not load history.");

        renderHistory(data.history || []);

    } catch (error) {

        console.error("History error:", error);

        showToast("Could not load chat history.");

    }

}



function renderHistory(history) {

    historyList.innerHTML = "";

    if (!history.length) {

        historyList.innerHTML = '<div class="history-empty">No conversations yet.</div>';

        return;

    }

    history.forEach((item) => {

        const element = document.createElement("button");

        element.type = "button";

        element.className = "history-item";

        element.title = item.question || "Open conversation";

        const icon = document.createElement("span");

        icon.className = "history-icon";

        icon.textContent = "💬";

        const title = document.createElement("span");

        title.className = "history-question";

        title.textContent = item.question || "New conversation";

        element.append(icon, title);

        element.addEventListener("click", () => openConversation(item.conversation_id || item.id));

        historyList.appendChild(element);

    });

}



async function openConversation(id) {

    if (isResearching) {

        showToast("Wait for the current research to finish before switching chats.");

        return;

    }

    stopSpeaking();

    stopVoiceInput();

    clearError();

    try {

        const response = await fetch(`/history/${encodeURIComponent(id)}`);

        const data = await response.json();

        if (!response.ok || !data.success) throw new Error(data.error || "Could not open this conversation.");

        conversationId = data.conversation_id || String(id);

        editingTurnId = null;

        welcome.classList.add("hidden");

        researchView.classList.remove("hidden");

        agentStatus.classList.add("hidden");

        chatMessages.innerHTML = "";

        renderConversation(data.conversation || []);

        questionTitle.textContent = "Research conversation";

        followupQuestion.value = "";

        followupButton.innerHTML = "Send <span>→</span>";

    } catch (error) {

        showError(error.message || "Could not open this conversation.");

    }

}



clearHistory.addEventListener("click", async () => {

    if (!confirm("Delete all saved conversations? This cannot be undone.")) return;

    try {

        const response = await fetch("/history/clear", { method: "DELETE" });

        const data = await response.json();

        if (!response.ok || !data.success) throw new Error(data.error || "Could not clear history.");

        startNewResearch();

        await loadHistory();

        showToast("Chat history cleared.");

    } catch (error) {

        showToast(error.message || "Could not clear history.");

    }

});
