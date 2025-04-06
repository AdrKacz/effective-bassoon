const form = document.getElementById('generate-image');
const submitButton = form.querySelector('input[type="submit"]');
const imageElement = document.getElementById('generated-image');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const textarea = form.querySelector('textarea[name="prompt"]');
  const promptText = textarea.value;

  // Disable button and add loading class
  submitButton.disabled = true;
  submitButton.classList.add('loading');

  try {
    const response = await fetch(import.meta.env.VITE_API_URL + 'image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: promptText,
        ratio: 'square',
      }),
    });

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
