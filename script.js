const WORKER_URL = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";

const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const welcome = document.getElementById("welcome");

let messages = [];

function addMessage(role, text) {

  if (welcome) {
    welcome.remove();
  }

  const wrapper = document.createElement("div");
  wrapper.className = "message";

  const avatar = document.createElement("div");
  avatar.className =
    "avatar " +
    (role === "user" ? "user-avatar" : "ai-avatar");

  avatar.textContent =
    role === "user" ? "YOU" : "A";

  const content = document.createElement("div");
  content.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";

  name.textContent =
    role === "user" ? "You" : "ANI AI";

  const textElement = document.createElement("div");
  textElement.textContent = text;

  content.appendChild(name);
  content.appendChild(textElement);

  wrapper.appendChild(avatar);
  wrapper.appendChild(content);

  chat.appendChild(wrapper);

  chat.scrollTop = chat.scrollHeight;

  return wrapper;
}


function addTyping() {

  const wrapper = document.createElement("div");
  wrapper.className = "message";
  wrapper.id = "typingMessage";

  const avatar = document.createElement("div");
  avatar.className = "avatar ai-avatar";
  avatar.textContent = "A";

  const content = document.createElement("div");
  content.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = "ANI AI";

  const typing = document.createElement("div");
  typing.className = "typing";

  typing.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  content.appendChild(name);
  content.appendChild(typing);

  wrapper.appendChild(avatar);
  wrapper.appendChild(content);

  chat.appendChild(wrapper);

  chat.scrollTop = chat.scrollHeight;
}


function removeTyping() {

  const element =
    document.getElementById("typingMessage");

  if (element) {
    element.remove();
  }
}


async function sendMessage(customText = null) {

  const text =
    customText || input.value.trim();

  if (!text) return;

  if (
    WORKER_URL.includes("PASTE_YOUR")
  ) {
    alert(
      "Add your Cloudflare Worker URL inside script.js first."
    );

    return;
  }

  input.value = "";
  input.style.height = "auto";

  addMessage("user", text);

  messages.push({
    role: "user",
    content: text
  });

  sendButton.disabled = true;

  addTyping();

  try {

    const response = await fetch(
      WORKER_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          messages: messages
        })
      }
    );

    const data = await response.json();

    removeTyping();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Something went wrong."
      );

    }

    const reply =
      data.reply ||
      "I couldn't generate a response.";

    addMessage("assistant", reply);

    messages.push({
      role: "assistant",
      content: reply
    });

  } catch (error) {

    removeTyping();

    addMessage(
      "assistant",
      "⚠️ " + error.message
    );

  } finally {

    sendButton.disabled = false;

    input.focus();
  }
}


sendButton.addEventListener(
  "click",
  () => sendMessage()
);


input.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }

  }
);


input.addEventListener(
  "input",
  () => {

    input.style.height = "auto";

    input.style.height =
      Math.min(
        input.scrollHeight,
        150
      ) + "px";

  }
);


document
  .getElementById("newChat")
  .addEventListener(
    "click",
    () => {

      messages = [];

      chat.innerHTML = `
        <div class="welcome" id="welcome">

          <div class="welcome-logo">
            A
          </div>

          <h2>Welcome to ANI AI</h2>

          <p>
            Your fast AI assistant powered by Cerebras.
          </p>

          <div class="suggestions">

            <button data-prompt="Explain artificial intelligence in simple words">
              🤖 Explain AI
            </button>

            <button data-prompt="Give me a cool website idea">
              💡 Website idea
            </button>

            <button data-prompt="Write a Python program for a beginner">
              💻 Write code
            </button>

            <button data-prompt="Tell me an interesting fact">
              🌎 Interesting fact
            </button>

          </div>

        </div>
      `;

      attachSuggestions();

    }
  );


document
  .getElementById("clearChat")
  .addEventListener(
    "click",
    () => {

      messages = [];

      chat.innerHTML = "";

      location.reload();

    }
  );


function attachSuggestions() {

  document
    .querySelectorAll("[data-prompt]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          sendMessage(
            button.dataset.prompt
          );

        }
      );

    });

}


attachSuggestions();
