import { get } from "./auth";

const template = document.getElementById('row-template');
const container = template.parentElement;
const loadMoreButton = document.getElementById('load-more')
const rowSpinner = document.getElementById('row-spinner')

async function images(next) {
    const url = new URL(import.meta.env.VITE_API_URL + 'subscribed/images')
    url.searchParams.append('limit', 9)
    if (typeof next === "string") {
        url.searchParams.append('start', next)
    }
    try {
        const response = await get(url.toString());
        if (!response.ok) {
            throw new Error(`Failed to fetch images: ${response.status}`);
        }
        return await response.json()
    } catch (error) {
        console.error('Error fetching images:', error);
        return { items: [], next: null };
    }
}

async function populate(next) {
    const numberOfDivs = template.querySelectorAll('div.tile').length
    rowSpinner.classList.remove('d-none')
    const data = await images(next);
    rowSpinner.classList.add('d-none')
    for (let i = 0; i < data.items.length; i += numberOfDivs) {
        const clone = template.cloneNode(true);
        const divs = clone.querySelectorAll('div.tile')
        for (let j = 0; j < divs.length; j += 1) {
            const index = i + j;
            if (index < data.items.length) {
                const item = data.items[index]
                divs[j].querySelector('img').src = item.url
                divs[j].querySelector('p').textContent = item.prompt
                divs[j].addEventListener('click', () => {
                    const url = new URL("/studio", window.location.origin)
                    url.searchParams.set("filename", item.filename)
                    window.location.href = url.toString()
                })
            } else {
                divs[j].classList.add('d-none')
            }
        }
        clone.classList.remove('d-none')
        container.appendChild(clone)
    }
    if (data.next) {
        loadMoreButton.setAttribute("data-next", data.next)
        loadMoreButton.classList.remove('d-none')
    } else {
        loadMoreButton.classList.add('d-none')
    }
} 

document.addEventListener("setup:done", populate)

loadMoreButton.addEventListener("click", async () => {
    loadMoreButton.disabled = true
    loadMoreButton.classList.add('disabled')
    await populate(loadMoreButton.getAttribute("data-next"))
    loadMoreButton.disabled = false
    loadMoreButton.classList.remove('disabled')
})

