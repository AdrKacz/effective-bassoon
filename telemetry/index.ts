import { Resource } from "sst";
import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { LOGO } from "./logo";

const UMAMI_WEBSITE_ID = Resource.UmamiWebsiteId.value
const UMAMI_API_KEY = Resource.UmamiApiKey.value

const app = new Hono()

app.get('/logo', async (c) => {
    const url = new URL(c.req.url)
    const email = url.searchParams.get('email')
    const title = url.searchParams.get('title')

    if (!email || !title) {
        return c.text('Missing required parameters', 400)
    }

    const payload = {
        payload: {
            hostname: 'local.le-studio-k.fr',
            language: 'en-US',
            referrer: '',
            screen: '1920x1080',
            title: 'Pixel',
            url: '/pixel',
            website: UMAMI_WEBSITE_ID,
            name: `Open email (${title})`,
            data: { email, title }
        },
        type: 'event',
    }

    try {
        console.log('Client User-Agent:', c.req.header('User-Agent'))
        const response = await fetch('https://cloud.umami.is/api/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-umami-api-key': UMAMI_API_KEY,
                // If the client user agent is not available, use a default legitimate user agent that looks like a real human
                'User-Agent': c.req.header('User-Agent') ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            },
            body: JSON.stringify(payload),
        })
        console.log('Response from Umami:', response.status, await response.text())
    } catch (error) {
        console.error('Error sending telemetry data:', error) // Return the pixel anyway
    }

    return c.body(LOGO, 200, {
        'Content-Type': 'image/png',
        'Content-Length': LOGO.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    })
})

export const handler = handle(app)