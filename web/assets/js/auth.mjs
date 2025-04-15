import { createClient } from "@openauthjs/openauth/client"
import { subjects } from "../../../auth/subjects"
const AUTH_URL = import.meta.env.VITE_AUTH_URL
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const CHALLENGE_VERIFIER_KEY = 'challenge_verifier'
const REDIRECT_URI_KEY = "redirect_uri"
const LAST_VERIFIED_KEY = "last_verified"
const USER_KEY = "user"

const client = createClient({
  clientID: "le-studio",
  issuer: AUTH_URL
})

const paymentButtons = document.querySelectorAll('a.payment-button');

export function getUser() {
    return JSON.parse(localStorage.getItem(USER_KEY))
}

export async function get(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem(ACCESS_TOKEN_KEY),
            'Content-Type': 'application/json',
        },
    });
    return response;
}

export async function post(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem(ACCESS_TOKEN_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return response;
}

async function authenticate() {
    // Retrieve the user authenticated and update UI if needed
    try {
        const response = await get(import.meta.env.VITE_API_URL + 'user')
        if (!response.ok) throw new Error(`Failed to fetch user: ${response.status}`);
        
        const user = await response.json()
        if (typeof user['email'] === 'string') {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            umami.identify({ email: user['email'] });
            for (const b of paymentButtons) {
                const url = new URL(b.href);
                url.searchParams.append("prefilled_email", user['email']);
                b.href = url.toString();
                b.classList.remove('disabled');
            }
        }
    } catch (error) {
        console.error('Error fetching user:', error);
    }
}

async function setup() {
    // Try to read code and state from query string
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const challengeVerifier = localStorage.getItem(CHALLENGE_VERIFIER_KEY)
    const redirectUri = localStorage.getItem(REDIRECT_URI_KEY)
    
    // Clean URL
    if (typeof code === "string" && typeof state === "string") {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        window.history.replaceState({}, document.title, url.pathname + url.search);
    }
    
    // Convert tokens
    if (typeof code === "string" && typeof state === "string" && typeof challengeVerifier === "string" && typeof redirectUri === "string") {
        localStorage.removeItem(CHALLENGE_VERIFIER_KEY)
        localStorage.removeItem(REDIRECT_URI_KEY)
        const exchanged = await client.exchange(code, redirectUri, challengeVerifier)
        if (exchanged.err) {
            console.error('Cannot exchange credentials', exchanged.err)
        } else {
            const { access, refresh } = exchanged.tokens
            localStorage.setItem(ACCESS_TOKEN_KEY, access)
            localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
            return authenticate()
        }
    }
    
    // Verify login information
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (accessToken) {
        const lastVerified = localStorage.getItem(LAST_VERIFIED_KEY)
        // Only re-verify once an hour on the client
        if (!lastVerified || (new Date() - new Date(lastVerified)) > 60 * 60 * 1000) {
            const verified = await client.verify(subjects, accessToken, {
                refresh: localStorage.getItem(REFRESH_TOKEN_KEY)
            })
            if (verified.err) {
                console.log("Cannot verify token", verified.err)
            } else {
                localStorage.setItem(LAST_VERIFIED_KEY, (new Date()).toISOString());
                if (verified.tokens) {
                    const { access, refresh } = verified.tokens
                    localStorage.setItem(ACCESS_TOKEN_KEY, access)
                    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
                }
                return authenticate()
            }
        } else {
            return authenticate()
        }
    }
    
    // Prepare login buttons
    document.querySelectorAll('a[data-event="Log in"]').forEach(async (link) => {
        const href = link.getAttribute('href');
        const { challenge, url } = await client.authorize(window.location.origin + href, "code", { pkce: true });
        link.href = url;
        link.addEventListener('click', (event) => {
            localStorage.setItem(REDIRECT_URI_KEY, window.location.origin + href);
            localStorage.setItem(CHALLENGE_VERIFIER_KEY, challenge.verifier);
        });
    });
}
setup().then(() => {
    const user = getUser();
    
    // Set indicators
    const isConnected = user !== null;
    let isSubscribed = false;
    if (isConnected) isSubscribed = user['is_subscribed'] === true;
    
    // Update elements that have condition on user status
    document.querySelectorAll('[display-condition]').forEach(el => {
        const condition = el.getAttribute('display-condition');
        if (condition === "connected") {
            if (isConnected) el.classList.remove('d-none');
            else el.classList.add('d-none');
        } else if (condition === "subscribed") {
            if (isSubscribed) el.classList.remove('d-none');
            else el.classList.add('d-none');
        } else if (condition === "not connected") {
            if (!isConnected) el.classList.remove('d-none');
            else el.classList.add('d-none');
        } else if (condition === "not subscribed") {
            if (!isSubscribed) el.classList.remove('d-none');
            else el.classList.add('d-none');
        } else {
            console.error('Display condition unknown:', condition)
        }
    });
    
    document.dispatchEvent(new Event("setup:done"));
})


document.getElementById('logout').addEventListener('click', () => {
    localStorage.clear()
})