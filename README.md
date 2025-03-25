**Event-Scheduler-Extension**
This Chrome extension extracts event details from selected text, allows users to fill missing event information via MCQs, and optionally adds the event to their Google Calendar. It uses the Gemini API for natural language processing to extract event details and handles Google Calendar integration securely.

**Table of Contents**

Overview
Features
Overview

This Chrome extension allows users to extract event details from selected text (using the Gemini API) and add the event to their Google Calendar. The extension can also prompt users to fill in missing event details through multiple-choice questions (MCQs).To ensure security and prevent exposing your Gemini API key in the extension's code, the user is required to provide their own Gemini API key. The extension will use this key to make requests to the Gemini API to extract event details from the selected text on a webpage.

**Features**

=>Extract Event Details: Extracts event details like title, date, start time, end time, location, and description from text using the Gemini API.
=>Fill Missing Fields: When fields are missing, the extension generates MCQs that users can answer to complete the event details.
=>Google Calendar Integration: Add the event directly to the user’s Google Calendar (OAuth integration via a secure backend).
=>Proxy Server for Security: API keys (Gemini and Google) are securely handled on the backend, avoiding exposure in the frontend (extension).
