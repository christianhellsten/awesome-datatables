const axios = require('axios');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs').promises;

const githubToken = process.env.GITHUB_TOKEN;
const dbPath = path.join(__dirname, 'github_repos.db');

const repositories = [
    { url: "https://github.com/javve/list.js", dependencies: "Vanilla JS" },
    { url: "https://github.com/fiduswriter/Simple-DataTables", dependencies: "Vanilla JS" },
    { url: "https://github.com/grid-js/gridjs", dependencies: "Vanilla JS" },
    { url: "https://github.com/ag-grid/ag-grid", dependencies: "Vanilla JS, Angular, React, Vue" },
    { url: "https://github.com/olifolkerd/tabulator", dependencies: "Vanilla JS, Optional jQuery" },
    { url: "https://github.com/wenzhixin/bootstrap-table", dependencies: "jQuery, Bootstrap" },
    { url: "https://github.com/DataTables/DataTables", dependencies: "jQuery" },
    { url: "https://github.com/mui/material-ui", dependencies: "React, Material-UI" },
    { url: "https://github.com/nick-keller/react-datasheet-grid", dependencies: "React" },
    { url: "https://github.com/glideapps/glide-data-grid", dependencies: "React" },
    { url: "https://github.com/TanStack/table", dependencies: "React" },
    { url: "https://github.com/mui/mui-x", dependencies: "React, Material-UI" },
    { url: "https://github.com/primer/view_components", dependencies: "Rails, ViewComponent" },
    { url: "https://github.com/ViewComponent/view_component", dependencies: "Rails" },
    { url: "https://github.com/matfish2/vue-tables-2", dependencies: "Vue.js" },
    { url: "https://github.com/angular/components", dependencies: "Angular, Angular Material" },
    { url: "https://github.com/valor-software/ngx-bootstrap", dependencies: "Angular, Bootstrap" },
    { url: "https://github.com/swimlane/ngx-datatable", dependencies: "Angular" },
    { url: "https://github.com/ag-grid/ag-grid", dependencies: "Angular, React, Vue" },
    { url: "https://github.com/xaksis/vue-good-table", dependencies: "Vue" },
    { url: "https://github.com/TonyGermaneri/canvas-datagrid", dependencies: "" },
    { url: "https://github.com/material-table-core/core", dependencies: "" },
    //{ url: "", dependencies: "" },
    //{ url: "", dependencies: "" },
    //{ url: "", dependencies: "" },
];

function calculateAgeInYears(creationDate) {
    const creation = new Date(creationDate);
    const current = new Date();
    return Math.floor((current - creation) / (1000 * 60 * 60 * 24 * 365));
}

function calculateAgeInDays(creationDate) {
    const creation = new Date(creationDate);
    const current = new Date();
    return Math.floor((current - creation) / (1000 * 60 * 60 * 24));
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to database.');
});

const createTableQuery = `CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY,
    url TEXT UNIQUE,
    dependencies TEXT,
    name TEXT,
    full_name TEXT,
    homepage TEXT,
    html_url TEXT,
    description TEXT,
    created_at DATE,
    updated_at DATE,
    issues_count INTEGER,
    stargazers_count INTEGER,
    watchers_count INTEGER,
    language TEXT,
    license TEXT,
    last_commit_date DATE,
    forks_count INTEGER
)`;

db.run(createTableQuery, (err) => {
    if (err) {
        console.error(err.message);
    }
});

async function fetchAllRepoDataFromDB() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM repositories ORDER BY stargazers_count DESC, issues_count ASC';
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function fetchRepoData(repoUrl) {
    const repoApiUrl = repoUrl.replace('https://github.com/', 'https://api.github.com/repos/');
    const commitsApiUrl = `${repoApiUrl}/commits`;

    try {
        const repoResponse = await axios.get(repoApiUrl, {
            headers: { 'Authorization': `token ${githubToken}` }
        });
        const repoData = repoResponse.data;

        const commitsResponse = await axios.get(commitsApiUrl, {
            headers: { 'Authorization': `token ${githubToken}` },
            params: { per_page: 1 } // Fetch only the latest commit
        });

        const latestCommit = commitsResponse.data[0];
        repoData.last_commit_date = latestCommit ? latestCommit.commit.committer.date : null;

        console.log(repoData)

        return repoData;
    } catch (error) {
        console.error('Error fetching repository data:', error);
    }
}

function insertRepoData(repoData) {
    const upsertQuery = `INSERT INTO repositories (
    name,
    url,
    dependencies,
    full_name,
    html_url,
    homepage,
    description,
    created_at,
    updated_at,
    stargazers_count,
    watchers_count,
    issues_count,
    language,
    forks_count,
    license,
    last_commit_date
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(url) DO UPDATE SET
    name = excluded.name,
    url = excluded.url,
    dependencies = excluded.dependencies,
    full_name = excluded.full_name,
    description = excluded.description,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    stargazers_count = excluded.stargazers_count,
    watchers_count = excluded.watchers_count,
    issues_count = excluded.issues_count,
    language = excluded.language,
    forks_count = excluded.forks_count,
    license = excluded.license,
    last_commit_date = excluded.last_commit_date`;

    db.run(upsertQuery, [
        repoData.name,
        repoData.url,
        repoData.dependencies,
        repoData.full_name,
        repoData.html_url,
        repoData.homepage,
        repoData.description,
        repoData.created_at,
        repoData.updated_at,
        repoData.stargazers_count,
        repoData.watchers_count,
        repoData.open_issues,
        repoData.language,
        repoData.forks_count,
        repoData.license ? repoData.license.spdx_id : null,
        repoData.last_commit_date
    ], (err) => {
        if (err) {
            console.error(err);
        }
    });
}

(async () => {
    for (let repo of repositories) {
        const repoData = await fetchRepoData(repo.url);
        repoData.url = repo.url;
        repoData.dependencies = repo.dependencies;
        insertRepoData(repoData);
    }
    const html = await generateTable();
    const markdown = await generateMarkdownTable();
    await fs.writeFile('index.html', html, 'utf8');
    await fs.writeFile('README.md', markdown, 'utf8');
})();

async function fetchRepoDataFromDB(repoUrl) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM repositories WHERE html_url = ?';
        db.get(query, [repoUrl], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function generateTable() {
    let html = '<table><tr><th>Name</th><th>Dependencies</th><th>License</th><th>Age (Years)</th><th>Stars</th><th>Issues</th><th>Last Commit (days)</th></tr>';

    const repoDataList = await fetchAllRepoDataFromDB();

    for (const repoData of repoDataList) {
        if (repoData) {
            const age = calculateAgeInYears(repoData.created_at);
            const daysSinceLastCommit = calculateAgeInDays(repoData.last_commit_date);

            html += `<tr><td><a href="${repoData.html_url}">${repoData.name}</a></td><td>${repoData.dependencies}</td><td>${repoData.license || 'Unknown'}</td><td>${age}</td><td>${repoData.stargazers_count}</td><td>${repoData.issues_count}</td><td>${daysSinceLastCommit}</td></tr>`;
        }
    }

    html += '</table>';
    html += `<p>Last Updated At: ${new Date().toLocaleString()}</p>`;
    return html;
}

async function generateMarkdownTable() {
    let markdown = '| Name | Dependencies | License | Stars | Issues | Age (Years) | Last Commit (days) |\n';
    markdown += '|------|--------------|--------|-------|--------|-------------|-------------|\n';

    const repoDataList = await fetchAllRepoDataFromDB();

    for (const repoData of repoDataList) {
        const age = calculateAgeInYears(repoData.created_at);
        const daysSinceLastCommit = calculateAgeInDays(repoData.last_commit_date);

        markdown += `| [${repoData.full_name}](https://github.com/${repoData.full_name}) | ${repoData.dependencies} | ${repoData.license || 'Unknown'} | `;
        markdown += `![Stars](https://img.shields.io/github/stars/${repoData.full_name}?style=social) | `;
        markdown += `![Issues](https://img.shields.io/github/issues/${repoData.full_name}) | `;
        markdown += `${repoData.issues_count} | ${age} | ${daysSinceLastCommit} |\n`;
    }

    markdown += `\n_Last Updated At: ${new Date().toLocaleString()}_\n`;
    return markdown;
}

