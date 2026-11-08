import os
import time
import threading

import requests

from flask import Flask, request, jsonify
from flask_cors import CORS
from gradio_client import Client


# ==========================================
# ELECTROQ BACKEND CONFIGURATION
# ==========================================

app = Flask(__name__)

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", ""
).rstrip("/")

SUPABASE_PUBLISHABLE_KEY = os.environ.get(
    "SUPABASE_PUBLISHABLE_KEY", ""
)

FRONTEND_ORIGIN = os.environ.get(
    "FRONTEND_ORIGIN",
    "https://mtc2026.github.io"
)

HF_SPACE_ID = "DEVELOPERDARSHAN/electroq"

HF_TOKEN = os.environ.get("HF_TOKEN", "")


# ==========================================
# CORS CONFIGURATION
# ==========================================

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [FRONTEND_ORIGIN]
        }
    }
)


# ==========================================
# HUGGING FACE CONNECTION
# ==========================================

# Connect to your existing Hugging Face Space.
# The model remains hosted on Hugging Face.
# Render does not download or load the model.

if HF_TOKEN:

    hf_client = Client(
        HF_SPACE_ID,
        hf_token=HF_TOKEN
    )

else:

    hf_client = Client(HF_SPACE_ID)


# ==========================================
# HUGGING FACE API DIAGNOSTIC
# ==========================================

# This prints the API endpoints exposed by your Space.
# We need this information to identify the correct
# api_name for the ElectroQ chat function.

print("========== HUGGING FACE API INFO ==========")

try:

    hf_client.view_api()

except Exception as e:

    print("API inspection error:", str(e))

print("===========================================")


# ==========================================
# RATE LIMITING
# ==========================================

RATE_LIMIT = 20

RATE_WINDOW = 60

request_counts = {}

rate_limit_lock = threading.Lock()


def check_rate_limit():

    ip_address = request.remote_addr or "unknown"

    current_time = time.time()

    with rate_limit_lock:

        if ip_address not in request_counts:

            request_counts[ip_address] = []

        request_counts[ip_address] = [

            timestamp

            for timestamp in request_counts[ip_address]

            if current_time - timestamp < RATE_WINDOW

        ]

        if len(request_counts[ip_address]) >= RATE_LIMIT:

            return False

        request_counts[ip_address].append(current_time)

        return True


# ==========================================
# SUPABASE AUTHENTICATION
# ==========================================

def get_authenticated_user():

    authorization = request.headers.get(
        "Authorization",
        ""
    )

    if not authorization.startswith("Bearer "):

        return None

    access_token = authorization.split(
        " ",
        1
    )[1].strip()

    if not access_token:

        return None

    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:

        app.logger.error(
            "Supabase environment variables are missing."
        )

        return None

    try:

        # Ask Supabase Auth to validate the access token.
        # Do not simply decode the JWT and trust its contents.

        response = requests.get(

            f"{SUPABASE_URL}/auth/v1/user",

            headers={

                "apikey": SUPABASE_PUBLISHABLE_KEY,

                "Authorization": f"Bearer {access_token}"

            },

            timeout=10

        )

        if response.status_code != 200:

            return None

        user = response.json()

        if not user.get("id"):

            return None

        return user

    except requests.RequestException:

        app.logger.exception(
            "Supabase authentication request failed."
        )

        return None


# ==========================================
# HEALTH CHECK
# ==========================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({

        "status": "ok",

        "service": "ElectroQ AI Backend"

    })


# ==========================================
# PRIVATE TEST ENDPOINT
# ==========================================

@app.route("/api/private", methods=["GET"])
def private_endpoint():

    user = get_authenticated_user()

    if not user:

        return jsonify({

            "error": "Authentication required."

        }), 401

    return jsonify({

        "message": "Authentication successful.",

        "user_id": user["id"]

    })


# ==========================================
# ELECTROQ CHAT ENDPOINT
# ==========================================

@app.route("/api/chat", methods=["POST"])
def chat():

    # --------------------------------------
    # 1. Rate limit
    # --------------------------------------

    if not check_rate_limit():

        return jsonify({

            "error": "Too many requests. Please wait."

        }), 429

    # --------------------------------------
    # 2. Authenticate user
    # --------------------------------------

    user = get_authenticated_user()

    if not user:

        return jsonify({

            "error": "Invalid or expired session. Please log in again."

        }), 401

    # --------------------------------------
    # 3. Validate request
    # --------------------------------------

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({

            "error": "Invalid request body."

        }), 400

    message = data.get("message", "")

    if not isinstance(message, str):

        return jsonify({

            "error": "Message must be text."

        }), 400

    message = message.strip()

    if not message:

        return jsonify({

            "error": "Message cannot be empty."

        }), 400

    if len(message) > 4000:

        return jsonify({

            "error": "Message is too long."

        }), 400

    # --------------------------------------
    # 4. Connect to Hugging Face Space
    # --------------------------------------

    try:

        # TEMPORARY DIAGNOSTIC:
        # We are inspecting the API name before
        # changing this call.

        result = hf_client.predict(
            message,
            [],
            api_name="chat"
        )

        # ----------------------------------
        # 5. Extract response
        # ----------------------------------

        if isinstance(result, str):

            reply = result

        elif isinstance(result, dict):

            reply = result.get(
                "text",
                result.get(
                    "reply",
                    result.get(
                        "value",
                        str(result)
                    )
                )
            )

        else:

            reply = str(result)

        if not reply:

            return jsonify({

                "error": "The AI returned an empty response."

            }), 502

        # ----------------------------------
        # 6. Return response to frontend
        # ----------------------------------

        return jsonify({

            "reply": reply

        })

    except Exception:

        app.logger.exception(
            "Hugging Face request failed."
        )

        return jsonify({

            "error": "ElectroQ AI is temporarily unavailable."

        }), 502


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":

    port = int(
        os.environ.get("PORT", 5000)
    )

    app.run(

        host="0.0.0.0",

        port=port

    )
