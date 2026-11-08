// ==================================================
// ELECTROQ CONFIGURATION
// ==================================================

// Your Supabase Project URL
const SUPABASE_URL = "https://uqbobolkzxuvfsczhppw.supabase.co";

// Your Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_8004ceJmYgLNxCmYj4BwIw_jklID26e";

// Your Render Backend URL
const BACKEND_URL =
    "https://electroq.onrender.com";

// Your GitHub Pages URL
const SITE_URL =
    "https://mtc2026.github.io/electroq/";


// ==================================================
// SUPABASE INITIALIZATION
// ==================================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==================================================
// HELPER: DISPLAY AUTHENTICATION MESSAGE
// ==================================================

function showAuthMessage(message, isError = true) {

    const messageElement =
        document.getElementById("auth-message");

    if (!messageElement) {
        return;
    }

    messageElement.textContent = message;

    messageElement.style.color = isError
        ? "#ff5555"
        : "#36d67c";
}


// ==================================================
// SIGNUP
// ==================================================

async function signUp() {

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const button =
        document.querySelector(".secondary-button");

    if (!email || !password) {

        showAuthMessage(
            "Please enter your email and password."
        );

        return;
    }

    if (password.length < 8) {

        showAuthMessage(
            "Password must contain at least 8 characters."
        );

        return;
    }

    button.disabled = true;

    showAuthMessage(
        "Creating your ElectroQ account...",
        false
    );

    try {

        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    emailRedirectTo: SITE_URL

                }

            });

        if (error) {

            showAuthMessage(error.message);

            return;
        }

        // Email confirmation is enabled.
        // The user must confirm their email
        // before accessing the application.

        if (data.user && !data.session) {

            showAuthMessage(
                "Account created! Please check your email to confirm your account.",
                false
            );

            return;
        }

        // If email confirmation is disabled,
        // Supabase may create an active session.

        if (data.session) {

            window.location.replace("chat.html");

        }

    } catch (error) {

        console.error("Signup error:", error);

        showAuthMessage(
            "Signup failed. Please try again."
        );

    } finally {

        button.disabled = false;

    }

}


// ==================================================
// LOGIN
// ==================================================

async function signIn() {

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const button =
        document.querySelector(".primary-button");

    if (!email || !password) {

        showAuthMessage(
            "Please enter your email and password."
        );

        return;
    }

    button.disabled = true;

    showAuthMessage(
        "Signing in...",
        false
    );

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({

                email: email,

                password: password

            });

        if (error) {

            showAuthMessage(
                "Login failed. Check your email and password."
            );

            return;
        }

        // Check whether Supabase returned a session.

        if (!data.session) {

            showAuthMessage(
                "Unable to create a session. Please try again."
            );

            return;
        }

        // Login successful.

        window.location.replace("chat.html");

    } catch (error) {

        console.error("Login error:", error);

        showAuthMessage(
            "An unexpected error occurred."
        );

    } finally {

        button.disabled = false;

    }

}


// ==================================================
// CHECK AUTHENTICATION
// ==================================================

async function requireLogin() {

    try {

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error || !data.session) {

            window.location.replace("index.html");

            return null;
        }

        // Check the authenticated user's email.

        const user = data.session.user;

        if (!user.email_confirmed_at) {

            await supabaseClient.auth.signOut();

            window.location.replace("index.html");

            return null;
        }

        return data.session;

    } catch (error) {

        console.error(
            "Authentication check failed:",
            error
        );

        window.location.replace("index.html");

        return null;
    }

}


// ==================================================
// LOGOUT
// ==================================================

async function signOut() {

    try {

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    } finally {

        window.location.replace("index.html");

    }

}


// ==================================================
// SEND MESSAGE TO ELECTROQ
// ==================================================

async function sendMessage() {

    const input =
        document.getElementById("user-input");

    const chatBox =
        document.getElementById("chat-box");

    const sendButton =
        document.getElementById("send-button");

    if (!input || !chatBox || !sendButton) {
        return;
    }

    const message = input.value.trim();

    if (!message) {
        return;
    }

    if (sendButton.disabled) {
        return;
    }

    // Get the current session.

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error || !data.session) {

        window.location.replace("index.html");

        return;
    }

    const accessToken =
        data.session.access_token;

    // Display the user's message.

    const userMessage =
        document.createElement("div");

    userMessage.className =
        "message user-message";

    userMessage.textContent = message;

    chatBox.appendChild(userMessage);

    // Clear the input.

    input.value = "";

    // Create loading message.

    const loadingMessage =
        document.createElement("div");

    loadingMessage.className =
        "message ai-message";

    loadingMessage.textContent =
        "ElectroQ is thinking...";

    chatBox.appendChild(loadingMessage);

    chatBox.scrollTop =
        chatBox.scrollHeight;

    sendButton.disabled = true;

    try {

        // Send authenticated request to Render.

        const response = await fetch(
            `${BACKEND_URL}/api/chat`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Authorization":
                        `Bearer ${accessToken}`

                },

                body: JSON.stringify({

                    message: message

                })

            }
        );

        // Handle expired authentication.

        if (response.status === 401) {

            await supabaseClient.auth.signOut();

            window.location.replace("index.html");

            return;
        }

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error || "Request failed."
            );
        }

        // Display AI response.

        loadingMessage.textContent =
            result.reply || "No response received.";

    } catch (error) {

    console.error(
        "ElectroQ request error:",
        error
    );

    loadingMessage.textContent =
        "Error: " + error.message;

    } finally {

        sendButton.disabled = false;

        chatBox.scrollTop =
            chatBox.scrollHeight;

    }

}


// ==================================================
// CLEAR CHAT
// ==================================================

function clearChat() {

    const chatBox =
        document.getElementById("chat-box");

    if (!chatBox) {
        return;
    }

    chatBox.innerHTML = `

        <div class="welcome-message">

            <h1>What can I help you with?</h1>

            <p>
                Ask ElectroQ about electronics,
                Arduino, coding, and more.
            </p>

        </div>

    `;

        }
