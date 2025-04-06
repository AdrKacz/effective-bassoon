import { createClient } from "@openauthjs/openauth/client"
import { subjects } from "../../../auth/subjects"
const AUTH_URL = import.meta.env.VITE_AUTH_URL
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const CHALLENGE_VERIFIER_KEY = 'challenge_verifier'
const REDIRECT_URI_KEY = "redirect_uri"
const LAST_VERIFIED_KEY = "last_verified"
const PUBLIC_PAGES = ['/', '/contacts', '/pricing']

const client = createClient({
  clientID: "le-studio",
  issuer: AUTH_URL
})

const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function setup() {
    // Try to read code and state from query string
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const challengeVerifier = localStorage.getItem(CHALLENGE_VERIFIER_KEY)
    const redirectUri = localStorage.getItem(REDIRECT_URI_KEY)
    console.log("Code", code)
    console.log("State", state)
    console.log("Challenge verifier", challengeVerifier)
    console.log("Redirect Uri", redirectUri)
    
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
            loginButton.style.display = 'none';
            return
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
                return
            }
        } else {
            return
        }
    }
    if (!PUBLIC_PAGES.includes(window.location.pathname)) {
      window.location.href = '/'
    } 
    logoutButton.classList.add('d-none')
    loginButton.classList.remove('d-none')
    document.querySelectorAll('nav .private-tab').forEach(item => item.classList.add('d-none'))
    const { challenge, url } = await client.authorize(window.location.href, "code", { pkce: true })
    localStorage.setItem(REDIRECT_URI_KEY, window.location.href);
    localStorage.setItem(CHALLENGE_VERIFIER_KEY, challenge.verifier);
    loginButton.href = url;
}
setup()


logoutButton.addEventListener('click', () => {
    localStorage.clear()
    location.reload()
})