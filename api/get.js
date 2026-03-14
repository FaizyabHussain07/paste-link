export default async function handler(req, res) {
    const { id } = req.query;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    try {
        const response = await fetch(`${url}/get/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();

        if (!result.result) {
            return res.status(404).json({ error: 'Not found' });
        }

        const data = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;

        // Final safety check for timestamp expiry
        if (data.expiresAt && data.expiresAt < Date.now()) {
            return res.status(404).json({ error: 'Expired' });
        }

        // Handle Server-Side Burn After Read
        if (data.burnAfterRead) {
            await fetch(`${url}/del/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                method: 'POST'
            });
        }

        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
