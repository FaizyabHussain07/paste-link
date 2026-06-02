// feedback.js - Global Feedback System

document.addEventListener('DOMContentLoaded', () => {
    // Inject Feedback UI
    const feedbackHTML = `
        <button id="pl-feedback-btn" class="feedback-floating-btn">
            💬 Feedback
        </button>

        <div id="pl-feedback-modal" class="feedback-modal-overlay" style="display:none;">
            <div class="feedback-modal">
                <div class="feedback-header" style="flex-direction: column; align-items: flex-start; position: relative;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.2rem;">💬 Share Your Experience with PasteLink</h3>
                    <p style="font-size: 0.8rem; color: var(--text-2); margin-top: 0;">Help us improve PasteLink and share your experience with others.</p>
                    <button id="pl-feedback-close" class="icon-btn" style="position: absolute; top: 0; right: 0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="pl-feedback-form">
                    <div class="feedback-field">
                        <label>What did you like most?</label>
                        <textarea id="fb-message" required></textarea>
                    </div>
                    <div class="feedback-field">
                        <label>What can we improve?</label>
                        <textarea id="fb-improve"></textarea>
                    </div>
                    <div class="feedback-field">
                        <label>Any feature you would like to see?</label>
                        <textarea id="fb-feature"></textarea>
                    </div>
                    <div class="feedback-row">
                        <div class="feedback-field">
                            <label>Name (optional)</label>
                            <input type="text" id="fb-name">
                        </div>
                        <div class="feedback-field">
                            <label>Country (optional)</label>
                            <input type="text" id="fb-country">
                        </div>
                    </div>
                    <label class="feedback-checkbox" style="margin-bottom: 0.2rem;">
                        <input type="checkbox" id="fb-allow-public">
                        <span>Allow my feedback to be displayed publicly as a testimonial</span>
                    </label>
                    <p style="font-size: 0.75rem; color: var(--text-3); margin-top: 0; margin-bottom: 1rem; padding-left: 1.5rem;">We only display testimonials from users who explicitly allow it.</p>
                    <button type="submit" class="btn-primary" id="fb-submit-btn" style="width: 100%; justify-content: center; margin-top: 10px;">Send Feedback</button>
                </form>
                <div id="fb-success" style="display: none; text-align: center; padding: 20px 0;">
                    <p>Thank you for your feedback! 🎉</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', feedbackHTML);

    const btn = document.getElementById('pl-feedback-btn');
    const modal = document.getElementById('pl-feedback-modal');
    const closeBtn = document.getElementById('pl-feedback-close');
    const form = document.getElementById('pl-feedback-form');
    const submitBtn = document.getElementById('fb-submit-btn');
    const successMsg = document.getElementById('fb-success');

    btn.addEventListener('click', () => {
        modal.style.display = 'flex';
        form.style.display = 'block';
        successMsg.style.display = 'none';
        form.reset();
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const data = {
            message_like: document.getElementById('fb-message').value,
            message_improve: document.getElementById('fb-improve').value,
            feature_request: document.getElementById('fb-feature').value,
            name: document.getElementById('fb-name').value,
            country: document.getElementById('fb-country').value,
            allow_testimonial: document.getElementById('fb-allow-public').checked
        };

        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            form.style.display = 'none';
            successMsg.style.display = 'block';

            // Track Feedback Events
            fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'feedback_submitted' })
            }).catch(() => {});

            if (data.allow_testimonial) {
                fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: 'testimonial_approved' })
                }).catch(() => {});
            }

        } catch (err) {
            console.error(err);
            alert('Failed to send feedback. Please try again later.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
        }
    });
});
