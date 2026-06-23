<div align="center">
  <img src="public/icons/icon111.png" width="128" height="128" alt="Handoff Logo">
  <h1>Handoff</h1>
  <p><b>Carry the thread. Drop the repeat-yourself. Seamlessly transfer AI conversations between ChatGPT, Claude, and Gemini.</b></p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#architecture">Architecture</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=google-chrome&logoColor=white" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-Plugin--CRXJS-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  </p>
</div>

<hr>

## 💡 Why Handoff?

Have you ever started a conversation with **ChatGPT**, only to realize the task is better suited for **Claude's** large context window or **Gemini's** web-search capabilities? Copying and pasting scattered messages, prompts, and code blocks is tedious and loses context. 

**Handoff** solves this by letting you capture entire threads natively, extracting the core intent, constraints, and progress, and then magically injecting it into the chat box of a different AI platform.

---

## ✨ Features

- 🔄 **Cross-Platform Capture:** Natively integrates with ChatGPT, Claude, and Gemini chat interfaces.
- 🧠 **Smart Structuring (Powered by Gemini):** Automatically reads your unstructured chat and summarizes the overarching goals, specific constraints, and key decisions.
- ⚡ **One-Click Inject:** Select a captured thread from your sidebar and inject the structured context directly into a new AI platform.
- 💾 **Draft Recovery:** Accidentally refreshed the page? Handoff automatically saves your unsaved chat inputs so you never lose your prompt.
- 🎨 **Beautiful Native UI:** Features sleek dark and light modes, seamlessly integrated floating action buttons, and a powerful slide-out sidebar that feels native.
- 🔒 **Privacy First:** 100% of your data is stored locally via IndexedDB. No remote servers, no cloud storage. 

---

## 🚀 Installation

Install Handoff directly into Chrome in less than a minute.

### 📥 1. Download the Extension
[ Click here to download the Handoff `.zip`](https://github.com/Reshi12/HeadOFF/archive/refs/heads/main.zip)

### 🔧 2. Load into Chrome
1. Extract the downloaded `.zip` file to a folder on your computer.
2. Open Google Chrome and navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** by toggling the switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the extracted folder you created in Step 1.

### 🔑 3. Setup API Key
To enable the smart context structuring, you need a Gemini API Key.
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the Handoff extension icon in your Chrome toolbar.
3. Paste your API key into the setup field and click **Save**.

---

## 💻 Usage

1. **Capture a Thread:**
   - Head to ChatGPT, Claude, or Gemini.
   - Look for the **Handoff Floating Button** at the bottom right of your chat input.
   - Click it to capture the conversation. Add a title or tags if desired.
2. **Inject Context:**
   - Open your target AI platform (e.g., switching from ChatGPT to Claude).
   - Open the Handoff Sidebar or Popup.
   - Select your saved thread and click **Insert** to instantly drop the summarized context into the chat.

---

## 🏗️ Architecture & Stack

Built for speed and modern web standards:
- **Framework:** [React 18](https://reactjs.org/)
- **Build Tool:** [Vite](https://vitejs.dev/) + [CRXJS](https://crxjs.dev/vite-plugin) (Vite plugin for Chrome Extensions)
- **Styling:** Vanilla CSS with a custom, high-performance design token system
- **Storage:** Local IndexedDB wrapper
- **Extension API:** Chrome Manifest V3

---




