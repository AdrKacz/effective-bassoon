import { createClient } from "@openauthjs/openauth/client"
import { subjects } from "../../../auth/subjects"
const AUTH_URL = import.meta.env.VITE_AUTH_URL
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const CHALLENGE_VERIFIER_KEY = 'challenge_verifier'
const REDIRECT_URI_KEY = "redirect_uri"
const LAST_VERIFIED_KEY = "last_verified"
const PUBLIC_PAGES = ['/', '/contacts', '/pricing', '/terms', '/policy']

const client = createClient({
  clientID: "le-studio",
  issuer: AUTH_URL
})

const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');
const overlayDiv = document.querySelector('.subscription-overlay');
const paymentButtons = document.querySelectorAll('a.payment-button');
const pPaymentConnectionDetails = document.querySelectorAll('p.payment-connection-details');


function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
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
        if (!response.ok) {
            throw new Error(`Failed to fetch user: ${response.status}`);
        }
        const user = await response.json()
        if (typeof user['user_id'] === 'string') {
            for (const b of paymentButtons) {
                const url = new URL(b.href);
                // TODO: Send User Email to prefill
                b.href = url.toString();
                b.classList.remove('disabled');
            }
            for (const p of pPaymentConnectionDetails) {
                p.classList.add('d-none');
            }
        }
        if (user['is_subscribed']) {
            console.log('You are subscribed.')
        } else {
            console.log('You are not subscribed.')
            if (overlayDiv) {
                overlayDiv.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        console.log('We assume you are not subscribed.');
        if (overlayDiv) {
            overlayDiv.classList.remove('d-none');
        }
        for (const p of pPaymentConnectionDetails) {
            p.classList.add('d-none');
        }
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
            loginButton.classList.add('d-none')
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
    if (!PUBLIC_PAGES.includes(window.location.pathname)) {
      window.location.href = '/'
    } 
    logoutButton.classList.add('d-none')
    loginButton.classList.remove('d-none')
    document.querySelectorAll('nav .private-tab').forEach(item => item.classList.add('d-none'))
    const { challenge, url } = await client.authorize(window.location.origin + "/studio", "code", { pkce: true })
    localStorage.setItem(REDIRECT_URI_KEY, window.location.origin + "/studio");
    localStorage.setItem(CHALLENGE_VERIFIER_KEY, challenge.verifier);
    loginButton.href = url;
}
setup()


logoutButton.addEventListener('click', () => {
    localStorage.clear()
    location.reload()
})