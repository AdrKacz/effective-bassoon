const form = document.getElementById('generate-image');
const textarea = form.querySelector('textarea[name="prompt"]');
const submitButton = form.querySelector('input[type="submit"]');
const imageElement = document.getElementById('generated-image');
const ACCESS_TOKEN_KEY = 'access_token'

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const promptText = textarea.value;

  // Disable button and add loading class
  submitButton.disabled = true;
  submitButton.classList.add('loading');

  try {
    const response = await fetch(import.meta.env.VITE_API_URL + 'image', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem(ACCESS_TOKEN_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: promptText,
        ratio: 'square',
      }),
    });
    if (!response.ok) {
        throw new Error(`Request failed with status: ${response.status}`)
    }
    const imageUrl = await response.text();
    imageElement.src = imageUrl;
  } catch (error) {
    console.error('Error:', error);
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
    const url = new URL("/image", import.meta.env.VITE_API_URL)
    url.searchParams.set("filename", filename)
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem(ACCESS_TOKEN_KEY),
            'Content-Type': 'application/json',
        },
    })
    if (!res.ok) throw new Error("Failed to fetch image");

    const data = await res.json();
    imageElement.src = data.url;
    textarea.value = data.prompt;
  } catch (err) {
    console.error("Error fetching image:", err);
  }
});