export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const bodyObj = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { message_like, message_improve, feature_request, name, country, allow_testimonial } = bodyObj;

        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            return res.status(500).json({ error: 'Database configuration missing' });
        }

        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const feedbackData = {
            id,
            message_like,
            message_improve,
            feature_request,
            name,
            country,
            allow_testimonial,
            created_at: new Date().toISOString()
        };

        const response = await fetch(`${url}/set/feedback:${id}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedbackData)
        });

        const result = await response.json();
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
