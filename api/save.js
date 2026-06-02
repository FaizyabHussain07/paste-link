export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const bodyObj = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { customId, expirySeconds, ...data } = bodyObj;

        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            return res.status(500).json({ error: 'Database configuration missing' });
        }

        const pasteData = {
            ...data,
            customId,
            expiresAt: Date.now() + (expirySeconds * 1000)
        };

        const dateStr = new Date().toISOString().split('T')[0];
        const expiryMap = {
            600: '10m',
            3600: '1h',
            43200: '12h',
            86400: '1d',
            604800: '7d'
        };
        const expiryLabel = expiryMap[expirySeconds] || 'custom';
        
        const pipelineBody = [
            ["SETEX", customId, expirySeconds, JSON.stringify(pasteData)],
            ["INCR", "stats:total_pastes"],
            ["INCR", `stats:daily:pastes:${dateStr}`],
            ["INCR", `stats:expiry:${expiryLabel}`]
        ];
        if (data.hasPassword) pipelineBody.push(["INCR", "stats:password_protected"]);
        if (data.burnAfterRead) pipelineBody.push(["INCR", "stats:burn_after_read"]);

        const response = await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pipelineBody)
        });

        const result = await response.json();
        if (!response.ok || result.error) {
            return res.status(500).json({ error: result.error || 'Upstash pipeline failed' });
        }
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
