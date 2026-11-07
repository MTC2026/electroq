// ==========================================
// ELECTROQ CONFIGURATION
// ==========================================

// Replace these with your actual Supabase values.

const SUPABASE_URL = "https://uqbobolkzxuvfsczhppw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8004ceJmYgLNxCmYj4BwIw_jklID26e";


// Replace this with your actual Render backend URL.

const BACKEND_URL = "https://electroq.onrender.com";


// ==========================================
// SUPABASE INITIALIZATION
// ==========================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==========================================
// LOGIN AND SIGNUP
// ==========================================

async function signUp() {

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("auth-message");

    const button = document.querySelector(".secondary-button");

    if (!email || !password) {
        message.textContent = "Enter your email and password.";
        return;
    }

    button.disabled = true;
    message.textContent = "Creating your ElectroQ account...";

    try {

        const { data, error } = await supabaseClient.auth.signUp({

            email: email,
            password: password,

            options: {
                emailRedirectTo:
                    "https://mtc2026.github.io/electroq/"
            }

        });

        if (error) {
            throw error;
        }

        message.textContent =
            "Account created! Check your email for confirmation.";

    } catch (error) {

        console.error("Signup error:", error);

        message.textContent =
            error.message || "Signup failed. Please try again.";

    } finally {

        button.disabled = false;

    }
}

    message.textContent = "Creating account...";

    const { data, error } = await supabaseClient.auth.signUp({

        email: email,

        password: password,

        options: {

            emailRedirectTo:
                "https://mtc2026.github.io/electroq/"

        }

    });

    if (error) {

        message.textContent = error.message;

        return;

    }

    message.textContent =
        "Account created! Please check your email to confirm.";

}

    message.textContent = "Creating your account...";

    const { data, error } = await supabaseClient.auth.signUp({

        email: email,

        password: password

    });

    if (error) {

        message.textContent = error.message;

        return;
    }

    message.textContent =
        "Account created. Check your email if confirmation is required.";
}


// ==========================================
// LOGIN
// ==========================================

async function signIn() {

    const email = document.getElementById("email").value.trim();

    const password = document.getElementById("password").value;

    const message = document.getElementById("auth-message");

    if (!email || !password) {

        message.textContent = "Enter your email and password.";

        return;
    }

    message.textContent = "Logging in...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

    });

    if (error) {

        message.textContent = error.message;

        return;
    }

    window.location.href = "chat.html";
}


// ==========================================
// LOGOUT
// ==========================================

async function signOut() {

    await supabaseClient.auth.signOut();

    window.location.href = "index.html";
}


// ==========================================
// CHECK AUTHENTICATION
// ==========================================

async function requireLogin() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {

        window.location.href = "index.html";

        return null;
    }

    return data.session;
}


// ==========================================
// SEND MESSAGE TO ELECTROQ
// ==========================================

async function sendMessage() {

    const input = document.getElementById("user-input");

    const message = input.value.trim();

    if (!message) return;

    const chatBox = document.getElementById("chat-box");

    const sendButton = document.getElementById("send-button");

    input.value = "";

    // Display user's message.

    const userMessage = document.createElement("div");

    userMessage.className = "message user-message";

    userMessage.textContent = message;

    chatBox.appendChild(userMessage);


    // Display loading message.

    const loadingMessage = document.createElement("div");

    loadingMessage.className = "message ai-message";

    loadingMessage.textContent = "ElectroQ is thinking...";

    chatBox.appendChild(loadingMessage);

    chatBox.scrollTop = chatBox.scrollHeight;

    sendButton.disabled = true;


    try {

        // Get the current Supabase session.

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error || !data.session) {

            window.location.href = "index.html";

            return;
        }


        // Get the access token.

        const accessToken = data.session.access_token;


        // Send the request to Render.

        const response = await fetch(
            `${BACKEND_URL}/api/chat`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Authorization": `Bearer ${accessToken}`

                },

                body: JSON.stringify({

                    message: message

                })

            }
        );


        // Handle expired or invalid authentication.

        if (response.status === 401) {

            await supabaseClient.auth.signOut();

            window.location.href = "index.html";

            return;
        }


        const result = await response.json();


        if (!response.ok) {

            throw new Error(result.error || "Request failed.");
        }


        // Display the AI response.

        loadingMessage.textContent = result.reply;


    } catch (error) {

        loadingMessage.textContent =
            "ElectroQ is currently unavailable. Please try again.";

        console.error(error);

    } finally {

        sendButton.disabled = false;

        chatBox.scrollTop = chatBox.scrollHeight;
    }
}
