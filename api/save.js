export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { customId, expirySeconds, ...data } = JSON.parse(req.body);
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    try {
        const pasteData = {
            ...data,
            customId,
            expiresAt: Date.now() + (expirySeconds * 1000)
        };

        const response = await fetch(`${url}/set/${customId}?ex=${expirySeconds}`, {
            headers: { Authorization: `Bearer ${token}` },
            method: 'POST',
            body: JSON.stringify(pasteData)
        });

        const result = await response.json();
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
