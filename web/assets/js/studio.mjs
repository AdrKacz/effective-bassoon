import { get, post, getUser } from "./auth";

const form = document.getElementById('generate-image');
const textarea = form.querySelector('textarea[name="prompt"]');
const submitButton = form.querySelector('input[type="submit"]');
const imageElement = document.getElementById('generated-image');
const downloadLink = document.getElementById('download-image')

const pRemainingCredits = document.getElementById('remaining-credits');
const pGetMoreCredits = document.getElementById('get-more-credits');
const pGetSubscription = document.getElementById('get-subscription');
const pNoMoreCredits = document.getElementById('no-more-credits');

const pError = document.getElementById('generation-error')

if (pError) pError.dataset['originaltext'] = pError.textContent;

function getRemainingCreditsHtml(value) {
    let innerHtml = `Il te reste <strong>${value}</strong> image`;
    if (value > 1) innerHtml += 's.';
    else innerHtml += '.';
    
    return innerHtml;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Don't reload the page
    
    // Disable inputs
    submitButton.disabled = true;
    textarea.disabled = true;
    // Re-init errors (if any)
    pError.classList.add('d-none');
    pError.textContent = pError.dataset['originaltext'];
    
    // Re-init information messages
    pRemainingCredits.classList.add('d-none');
    pGetMoreCredits.classList.add('d-none');
    pGetSubscription.classList.add('d-none');
    pNoMoreCredits.classList.add('d-none');
        
    // Re-init download link (not clear what should be download during the generation)
    downloadLink.removeAttribute('href')
    downloadLink.removeAttribute('download')
    downloadLink.classList.add('d-none');
    
    try {
        const data = await startProgressBarWithImageGeneration(textarea.value);
        imageElement.src = data.url; // Display image
        updateDownloadLink(data);
        
        // Display information messages
        const remainingCredits = parseInt(data['remaining_credits']);
        if (remainingCredits === 0) {
            // Show options to get more credits
            if (!getUser()['is_subscribed']) pGetSubscription.classList.remove('d-none');
            else pNoMoreCredits.classList.remove('d-none');
        } else {
            // Show remaining credits
            pRemainingCredits.innerHTML = getRemainingCreditsHtml(remainingCredits)
            pRemainingCredits.classList.remove('d-none');
            // Show options to get more credits if running low
            if (getUser()['is_subscribed'] && remainingCredits <= 5) pGetMoreCredits.classList.remove('d-none');
        }
    } catch (error) {
        console.error(error);
        if (error.message.includes('This prompt violates our terms of service.')) {
            pError.textContent = "Ta requête ne respecte pas nos conditions d’utilisation."
        } else if (error.message.includes('Not enough credits')) {
            pError.textContent = ""
            // Show options to get more credits
            if (!getUser()['is_subscribed']) pGetSubscription.classList.remove('d-none');
            else pNoMoreCredits.classList.remove('d-none');
        } else if (error.message.includes('Unauthorized')) {
            pError.textContent = "Tu n'es pas connecté."
        }
        if (pError.textContent) pError.classList.remove('d-none');
    } finally {
        // Re-enable inputs
        submitButton.disabled = false;
        textarea.disabled = false;
    }
});

async function updateDownloadLink({ url, prompt }) {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    downloadLink.href = blobUrl;
    downloadLink.download = prompt + '.png'
    downloadLink.classList.remove('d-none');
}

document.addEventListener("setup:done", async () => {
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
        updateDownloadLink(data);
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