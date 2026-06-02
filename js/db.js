/**
 * db.js — Database Service
 * 
 * Works purely through Vercel Serverless APIs for security.
 */

export const database = {
    async savePaste(data, retries = 3) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
                
                const response = await fetch('/api/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data),
                    signal: controller.signal
                });
                clearTimeout(timeout);
                
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    lastError = new Error(err.error || 'Failed to save');
                    if (i < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                        continue;
                    }
                    throw lastError;
                }
                const result = await response.json();
                return result;
            } catch (err) {
                lastError = err;
                if (i < retries - 1 && err.name !== 'AbortError') {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    continue;
                }
            }
        }
        throw lastError || new Error('Failed to save paste');
    },

    async getPaste(customId) {
        const response = await fetch(`/api/get?id=${customId}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to retrieve');
        }
        return response.json();
    },

    async deletePaste(customId) {
        const response = await fetch(`/api/delete?id=${customId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete');
        }
        return response.json();
    }
};
