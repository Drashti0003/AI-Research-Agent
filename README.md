# AI Research Agent 🔎

An AI-powered research assistant that helps users explore topics, search the web, and generate structured research responses through a simple web interface.

## 🚀 Overview

The AI Research Agent is a web application built with Flask and Python. It connects to a large language model through the Groq API and uses browser search capabilities to help answer research questions.

The project demonstrates how AI APIs, backend development, frontend technologies, and database storage can work together in one application.

## ✨ Features

- **AI-Powered Research:** Generate responses to user questions using an AI model.
- **Web Search:** Use browser search capabilities to support research responses.
- **Interactive Interface:** Ask questions through a simple web interface.
- **Conversation History:** Save and retrieve previous research using SQLite.
- **Multiple Languages:** Supports English, Hindi, and Gujarati interface interactions where implemented.
- **Voice Input:** Enter questions using speech recognition where browser support is available.
- **Text-to-Speech:** Listen to generated responses.
- **Dark and Light Mode:** Switch the interface theme.
- **Source Links:** Display available source links with research responses.
- **Error Handling:** Show user-friendly error messages.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Python | Backend logic and AI integration |
| Flask | Web application and API endpoints |
| HTML | Webpage structure |
| CSS | Styling and responsive layout |
| JavaScript | Frontend interactions and voice features |
| Groq API | Access to the AI model |
| GPT-OSS 20B | Language model used by the application |
| Browser Search | Web-search capability |
| SQLite | Store research history |
| Git and GitHub | Version control and project hosting |

## 📁 Project Structure

```text
AI-Research-Agent/
├── agent/
│   ├── __init__.py
│   ├── prompts.py
│   └── research_agent.py
├── database/
│   ├── __init__.py
│   └── history.py
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
├── templates/
│   └── index.html
├── .env                 # Create locally; do not upload
├── .gitignore
├── app.py
├── requirements.txt
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Drashti0003/AI-Research-Agent.git
cd AI-Research-Agent
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

Activate it on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

If activation is blocked by your system's execution policy, use Command Prompt instead:

```bat
venv\Scripts\activate.bat
```

### 3. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Configure the API key

Create a `.env` file in the project root directory:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Replace the example value with your own API key from the Groq developer platform.

**Security:** Never commit or share your `.env` file or API key. Keep it excluded through `.gitignore`.

### 5. Run the application

```bash
python app.py
```

Open the local application in your browser:

```text
http://127.0.0.1:5000
```

## 🔑 API and Model

- **API provider:** Groq
- **Model:** `openai/gpt-oss-20b`
- **Search capability:** Browser search through the supported API tool

API access, model availability, and search support depend on the provider's current configuration and account access.

## 🎯 Learning Outcomes

This project helped me explore:

- Connecting a Python application to an AI model through an API.
- Building a web application using Flask.
- Integrating frontend and backend components.
- Working with HTML, CSS, and JavaScript.
- Saving and retrieving application history using SQLite.
- Managing API keys securely with environment variables.
- Using Git and GitHub for version control.

## 🔮 Future Improvements

- Improve research accuracy and source verification.
- Add export options for research reports.
- Improve error handling and loading feedback.
- Deploy the application for public access.
- Add automated testing and further performance improvements.

## 👩‍💻 Author

**Drashti Ramani**

BCA — Artificial Intelligence and Data Analytics

GitHub: [@Drashti0003](https://github.com/Drashti0003)
Project Repository:  [AI Research Agent](https://github.com/Drashti0003/AI-Research-Agent)
---

*This project was developed as a learning project to explore AI integration, web development, and application design.*
