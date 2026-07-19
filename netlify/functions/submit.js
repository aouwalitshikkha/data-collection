const GH_API = 'https://api.github.com';

function ghHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

async function uploadFile(token, owner, repo, branch, path, base64, message) {
    const url = `${GH_API}/repos/${owner}/${repo}/contents/${path}`;
    const r = await fetch(url, {
        method: 'PUT',
        headers: ghHeaders(token),
        body: JSON.stringify({ message, content: base64, branch })
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(`Upload failed (${path}): ${r.status} ${t}`);
    }
    return (await r.json()).content.path;
}

async function createIssue(token, owner, repo, title, body, labels) {
    const url = `${GH_API}/repos/${owner}/${repo}/issues`;
    const r = await fetch(url, {
        method: 'POST',
        headers: ghHeaders(token),
        body: JSON.stringify({ title, body, labels })
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(`Issue creation failed: ${r.status} ${t}`);
    }
    return await r.json();
}

exports.handler = async (event) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'aouwalitshikkha';
    const repo = process.env.GITHUB_REPO || 'data-collection';
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
        return {
            statusCode: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'GITHUB_TOKEN env var not set on the Netlify function.' })
        };
    }

    try {
        const payload = JSON.parse(event.body);
        const data = payload.data || {};

        if (!data.submission_id) {
            data.submission_id = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        }
        data.submitted_at = data.submitted_at || new Date().toISOString();
        const folder = `submissions/${data.submission_id}`;
        data.repo_folder = folder;

        const files = payload.files || [];

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const path = `${folder}/files/${f.filename}`;
            await uploadFile(token, owner, repo, branch, path, f.base64, `Upload ${f.filename}`);
            const relPath = `files/${f.filename}`;
            if (f.field === 'business.logo_file') data.business.logo_file = relPath;
            else if (f.field && f.field.startsWith('projects[')) data.projects[f.index].image = relPath;
            else if (f.field && f.field.startsWith('team_members[')) data.team_members[f.index].photo = relPath;
        }

        const title = `Form Submission: ${data.submission_id}`;
        const body = `## Website Content Form Submission\n\nSubmission ID: \`${data.submission_id}\`\n\n<!-- SUBMISSION_JSON_START -->\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n<!-- SUBMISSION_JSON_END -->`;
        const issue = await createIssue(token, owner, repo, title, body, ['form-submission']);

        return {
            statusCode: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                issueUrl: issue.html_url,
                submissionId: data.submission_id,
                folder
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message || String(err) })
        };
    }
};