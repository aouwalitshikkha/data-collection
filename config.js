// This file is public — it contains ONLY the endpoint URL (no token).
// The GitHub token lives in Netlify environment variables, invisible to the browser.
window.FORM_CONFIG = {
    submitEndpoint: 'https://YOUR-NETLIFY-SITE-NAME.netlify.app/.netlify/functions/submit'
};