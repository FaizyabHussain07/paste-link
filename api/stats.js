export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    try {
        const pipelineBody = [
            ["GET", "stats:total_pastes"],
            ["GET", "stats:total_views"],
            ["GET", "stats:expiry:1h"],
            ["GET", "stats:expiry:1d"],
            ["GET", "stats:expiry:7d"]
        ];

        const response = await fetch(`${url}/pipeline`, {
            headers: { Authorization: `Bearer ${token}` },
            method: 'POST',
            body: JSON.stringify(pipelineBody)
        });

        const result = await response.json();
        
        let totalPastes = 0;
        let totalViews = 0;
        let popularExpiry = "1h";

        if (Array.isArray(result)) {
            totalPastes = parseInt(result[0]?.result || "0", 10);
            totalViews = parseInt(result[1]?.result || "0", 10);
            
            const exp1h = parseInt(result[2]?.result || "0", 10);
            const exp1d = parseInt(result[3]?.result || "0", 10);
            const exp7d = parseInt(result[4]?.result || "0", 10);
            
            if (exp1d > exp1h && exp1d > exp7d) popularExpiry = "1d";
            else if (exp7d > exp1h && exp7d > exp1d) popularExpiry = "7d";
        }

        return res.status(200).json({
            totalPastes,
            totalViews,
            popularExpiry,
            activeCountries: 14 // Static for now, hard to track easily without geoip
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
