import { Context } from "hono";
import { User } from '../types'

export async function getUser(c: Context<{ Variables: User }>) {
    const userId = c.get('user_id')
    if (!userId) {
        return c.text('Unauthorized', 401)
    }
    let isSubscribed = false
    if (typeof c.get('subscription_end_date') === 'string') {
        const subscriptionEndDate = new Date(c.get('subscription_end_date'))
        isSubscribed = subscriptionEndDate > new Date()
    }

    return c.json({
        remaining_credits: c.get('remaining_credits') ?? 0,
        is_subscribed: isSubscribed,
    })
}