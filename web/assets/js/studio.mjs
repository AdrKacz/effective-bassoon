import { get, post } from "./auth";

const form = document.getElementById('generate-image');
const textarea = form.querySelector('textarea[name="prompt"]');
const submitButton = form.querySelector('input[type="submit"]');
const imageElement = document.getElementById('generated-image');
const pRemainingCredits = document.getElementById('remaining-credits');
const pRemainingCreditsSpan = pRemainingCredits.querySelector('span');
const pNoMoreCredits = document.getElementById('no-more-credits');
const pError = document.getElementById('generation-error')
if (pError) {
    pError.dataset['originaltext'] = pError.textContent;
}


form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const promptText = textarea.value;

  // Disable button and add loading class
  submitButton.disabled = true;
  submitButton.classList.add('loading');
  pError.textContent = pError.dataset['originaltext'];
  pError.classList.add('d-none');

  try {
    const response = await post(import.meta.env.VITE_API_URL + 'subscribed/image', {
        prompt: promptText,
        ratio: 'square',
    })
    if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`)
    }
    const data = await response.json();
    imageElement.src = data.url;
    const remainingCredits = data['remaining_credits'];
    if (remainingCredits === 0) {
        pRemainingCredits.classList.add('d-none');
        pNoMoreCredits.classList.remove('d-none');
    } else {
        pRemainingCreditsSpan.textContent = remainingCredits;
        pRemainingCredits.classList.remove('d-none');
    }
  } catch (error) {
    console.error(error);
    if (error.message.includes('This prompt violates our terms of service.')) {
        pError.textContent = "Ta requête ne respecte pas nos conditions d’utilisation."
    }
    pError.classList.remove('d-none');
  } finally {
    // Re-enable button and remove loading class
    submitButton.disabled = false;
    submitButton.classList.remove('loading');
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const filename = params.get("filename");

  if (!filename) return;

  try {
    const url = new URL("/subscribed/image", import.meta.env.VITE_API_URL)
    url.searchParams.set("filename", filename)
    const res = await get(url);
    if (!res.ok) throw new Error("Failed to fetch image");

    const data = await res.json();
    imageElement.src = data.url;
    textarea.value = data.prompt;
  } catch (err) {
    console.error("Error fetching image:", err);
  }
});