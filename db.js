/**
 * db.js — Database Service
 * 
 * Works purely through Vercel Serverless APIs for security.
 */

export const database = {
    async savePaste(data) {
        const response = await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to save');
        }
        return response.json();
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
