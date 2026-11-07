import os
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# -----------------------------------
# APPLICATION CONFIGURATION
# -----------------------------------

app = Flask(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]

FRONTEND_ORIGIN = os.environ["FRONTEND_ORIGIN"].rstrip("/")


# -----------------------------------
# CORS
# -----------------------------------

# Only allow your actual frontend origin.
# CORS is not authentication.
# The backend still verifies every access token.

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [FRONTEND_ORIGIN]
        }
    },
    allow_headers=["Authorization", "Content-Type"],
    methods=["GET", "POST", "OPTIONS"]
)


# -----------------------------------
# RATE LIMITING
# -----------------------------------

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per hour"]
)


# -----------------------------------
# SECURITY HEADERS
# -----------------------------------

@app.after_request
def add_security_headers(response):

    response.headers["X-Content-Type-Options"] = "nosniff"

    response.headers["X-Frame-Options"] = "DENY"

    response.headers["Referrer-Policy"] = "no-referrer"

    response.headers["Cache-Control"] = "no-store"

    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    return response


# -----------------------------------
# AUTHENTICATION
# -----------------------------------

def verify_supabase_user():

    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return None

    access_token = authorization.split(" ", 1)[1].strip()

    if not access_token:
        return None

    try:

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

        # Require a valid user ID.
        if not user.get("id"):
            return None

        return user

    except requests.RequestException:

        return None


# -----------------------------------
# HEALTH CHECK
# -----------------------------------

@app.get("/health")
def health():

    return jsonify({
        "status": "online"
    })


# -----------------------------------
# PROTECTED TEST ENDPOINT
# -----------------------------------

@app.get("/api/private")
@limiter.limit("20 per minute")
def private_endpoint():

    user = verify_supabase_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    return jsonify({
        "message": "Authenticated successfully",
        "user_id": user["id"]
    })


# -----------------------------------
# AI ENDPOINT
# -----------------------------------

@app.post("/api/chat")
@limiter.limit("10 per minute")
def chat():

    # 1. Verify the user's Supabase token.

    user = verify_supabase_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401


    # 2. Validate the request body.

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "error": "Invalid request"
        }), 400


    message = data.get("message")

    if not isinstance(message, str):

        return jsonify({
            "error": "Message must be text"
        }), 400


    message = message.strip()

    if not message:

        return jsonify({
            "error": "Message cannot be empty"
        }), 400


    # 3. Limit message size.

    if len(message) > 4000:

        return jsonify({
            "error": "Message is too long"
        }), 413


    # 4. AI model integration goes here.
    #
    # IMPORTANT:
    # Your AI API token must be stored in Render.
    # Never put it in app.js or chat.html.
    #
    # We will connect your actual ElectroQ model here.


    return jsonify({
        "reply": "ElectroQ backend authentication is working.",
        "user_id": user["id"]
    })


# -----------------------------------
# START APPLICATION
# -----------------------------------

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
        )
