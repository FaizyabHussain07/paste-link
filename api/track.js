export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { event } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!event) {
        return res.status(400).json({ error: 'Missing event' });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: 'Database config missing' });
    }

    try {
        let redisKey = '';
        if (event === 'qr_usage') {
            redisKey = 'stats:qr_usage';
        } else {
            return res.status(400).json({ error: 'Unknown event' });
        }

        const response = await fetch(`${url}/incr/${redisKey}`, {
            headers: { Authorization: `Bearer ${token}` },
            method: 'POST'
        });

        const result = await response.json();
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
