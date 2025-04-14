import { get, post } from "./auth";

const form = document.getElementById('generate-image');
const textarea = form.querySelector('textarea[name="prompt"]');
const submitButton = form.querySelector('input[type="submit"]');
const imageElement = document.getElementById('generated-image');
const pRemainingCredits = document.getElementById('remaining-credits');
const pNoMoreCredits = document.getElementById('no-more-credits');
const pError = document.getElementById('generation-error')
if (pError) {
    pError.dataset['originaltext'] = pError.textContent;
}

const contactUsHtml = 'Plus beaucoup de crédits… <a href="/contacts.html">Contacte-nous</a> pour faire le plein avant la prochaine recharge.'


form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const promptText = textarea.value;

  // Disable button and add loading class
  submitButton.disabled = true;
  textarea.disabled = true;
  submitButton.classList.add('loading');
  pError.textContent = pError.dataset['originaltext'];
  pError.classList.add('d-none');

  try {
    const data = await startProgressBarWithImageGeneration(promptText);
    imageElement.src = data.url;
    const remainingCredits = data['remaining_credits'];
    if (remainingCredits === 0) {
        pRemainingCredits.classList.add('d-none');
        pNoMoreCredits.classList.remove('d-none');
    } else if (remainingCredits === 1) {
        pRemainingCredits.innerHTML = `Il te reste <strong>1</strong> crédit. ${contactUsHtml}`;
        pRemainingCredits.classList.remove('d-none');
    } else if (remainingCredits <= 5) {
        pRemainingCredits.innerHTML = `Il te reste <strong>${remainingCredits}</strong> crédits. ${contactUsHtml}`;
        pRemainingCredits.classList.remove('d-none');
    } else {
        pRemainingCredits.innerHTML = `Il te reste <strong>${remainingCredits}</strong> crédits.`;
        pRemainingCredits.classList.remove('d-none');
    }
  } catch (error) {
    console.error(error);
    if (error.message.includes('This prompt violates our terms of service.')) {
        pError.textContent = "Ta requête ne respecte pas nos conditions d’utilisation."
    } else if (error.message.includes('Not enough credits')) {
        pError.textContent = "Tu n'as pas de crédits."
    } else if (error.message.includes('Unauthorized')) {
        pError.textContent = "Tu n'es pas connecté."
    }
    pError.classList.remove('d-none');
  } finally {
    // Re-enable button and remove loading class
    submitButton.disabled = false;
    textarea.disabled = false;
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


async function generateImage(promptText) {
    const response = await post(import.meta.env.VITE_API_URL + 'subscribed/image', {
        prompt: promptText,
        ratio: 'square',
    })
    if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`)
    }
    const data = await response.json();
    return data;
}

function getDistributedIntegers(min, max, count) {
    const result = [];
    const range = max - min;
    const segmentSize = range / count;

    for (let i = 0; i < count; i++) {
        const segmentMin = Math.floor(min + i * segmentSize);
        const segmentMax = Math.floor(min + (i + 1) * segmentSize) - 1;
        const value = Math.floor(Math.random() * (segmentMax - segmentMin + 1)) + segmentMin;
        result.push(value);
    }

    return result;
}


async function startProgressBarWithImageGeneration(promptText) {
    const barEl = document.querySelector('#generation-progress .progress-bar');
    if (!barEl) return;
    document.querySelector('#generation-progress').classList.remove('d-none');

    // Reset to 0
    updateProgressBar(0);
    
    const averageDuration = 30000 // 30 seconds
    const averageDelay = 1000 // 1 second
    const minimumNumberOfStops = Math.floor(averageDuration / averageDelay * 0.8)
    const maximumNumberOfStops = Math.floor(averageDuration / averageDelay * 1.2)
    const numberOfStops = Math.floor(Math.random() * (maximumNumberOfStops - minimumNumberOfStops + 1)) + minimumNumberOfStops;
    const stops = getDistributedIntegers(0, 95, numberOfStops);

    let isDone = false;
    let resolveImage;
    let rejectImage;
    const imagePromise = new Promise((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
    });

    // Launch image generation
    const imageGenPromise = generateImage(promptText).then((data) => {
        isDone = true;
        updateProgressBar(100);
        resolveImage(data);
    }).catch((error) => {
        isDone = true;
        updateProgressBar(100);
        rejectImage(error); // Pass the error to the rejection
    });

    // Run animation phases
    (async () => {
        for (const stop of stops) {
            const pause = averageDelay - 250 + Math.random() * 500; // 0.5sec around the average delay
            await delay(pause)
            if (isDone) return;
            updateProgressBar(stop);
            if (isDone) return;
        }
    })();

    return imagePromise;
}

function updateProgressBar(value) {
    const barEl = document.querySelector('#generation-progress .progress-bar');
    barEl.style.width = `${value}%`;
    barEl.setAttribute('aria-valuenow', value.toString());
    barEl.querySelector('span').textContent = `${Math.round(value)}%`;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}