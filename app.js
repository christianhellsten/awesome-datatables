const axios = require('axios');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const path = require('path');


const githubToken = process.env.GITHUB_TOKEN;
const cacheFilePath = path.join(__dirname, 'github_data_cache.json');
const outputFilePath = path.join(__dirname, 'index.html');
const markdownOutputFilePath = path.join(__dirname, 'README.md');


const repositories = [
    // Vanilla Projects
    { name: "Simple-DataTables", user: "fiduswriter", repo: "Simple-DataTables", dependencies: "Vanilla JS" },
    { name: "Grid.js", user: "grid-js", repo: "gridjs", dependencies: "Vanilla JS" },
    // General Projects
    { name: "AG-Grid", user: "ag-grid", repo: "ag-grid", dependencies: "Vanilla JS, Angular, React, Vue" },
    { name: "Tabulator", user: "olifolkerd", repo: "tabulator", dependencies: "Vanilla JS, Optional jQuery" },
    { name: "Bootstrap Table", user: "wenzhixin", repo: "bootstrap-table", dependencies: "jQuery, Bootstrap" },
    // jQuery Projects
    { name: "DataTables", user: "DataTables", repo: "DataTables", dependencies: "jQuery" },
    // React Projects
    { name: "Material-UI Table", user: "mui-org", repo: "material-ui", dependencies: "React, Material-UI" },
    { name: "React Table", user: "tannerlinsley", repo: "react-table", dependencies: "React" },
    { name: "React Datasheet Grid", user: "nick-keller", repo: "react-datasheet-grid", dependencies: "React" },
    { name: "Glide Data Grid", user: "glideapps", repo: "glide-data-grid", dependencies: "React" },
    { name: "TanStack Table", user: "tanstack", repo: "table", dependencies: "React" },
    { name: "MUI X React Data Grid", user: "mui", repo: "mui-x", dependencies: "React, Material-UI" },
    // Rails ViewComponent Projects
    { name: "Primer ViewComponents", user: "primer", repo: "view_components", dependencies: "Rails, ViewComponent" },
    { name: "GitHub's ViewComponent", user: "github", repo: "view_component", dependencies: "Rails" },
    // Vue Projects
    { name: "Vue Tables 2", user: "matfish2", repo: "vue-tables-2", dependencies: "Vue.js" },
    // Angular Projects
    { name: "Angular Material", user: "angular", repo: "components", dependencies: "Angular, Angular Material" },
    { name: "NGX-Bootstrap", user: "valor-software", repo: "ngx-bootstrap", dependencies: "Angular, Bootstrap" },
];


async function fetchRepoData(user, repo) {
    const cache = await readCache();
    const cacheKey = `${user}/${repo}`;

    if (cache[cacheKey]) {
        // Use cached data if available
        return cache[cacheKey];
    }


    try {
        const axiosConfig = {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        };

        const repoResponse = await axios.get(`https://api.github.com/repos/${user}/${repo}`, axiosConfig);
        const commitsResponse = await axios.get(`https://api.github.com/repos/${user}/${repo}/commits`, axiosConfig);

        const data = {
            stars: repoResponse.data.stargazers_count,
            issues: repoResponse.data.open_issues_count,
            license: repoResponse.data.license ? repoResponse.data.license.spdx_id : 'Unknown',
            age: calculateAge(repoResponse.data.created_at),
            lastCommit: commitsResponse.data[0].commit.committer.date
        };

        // Update cache
        cache[cacheKey] = data;
        await writeCache(cache);

        return data;
    } catch (error) {
        console.error(`Error fetching repository data for ${repo}:`, error);
        return { stars: 'Error', issues: 'Error', license: 'Error', age: 'Error', lastCommit: 'Error' };
    }
}

function calculateAge(creationDate) {
    const creation = new Date(creationDate);
    const current = new Date();
    return Math.floor((current - creation) / (1000 * 60 * 60 * 24 * 365));
}

async function readCache() {
    try {
        const data = await fs.readFile(cacheFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function writeCache(cache) {
    try {
        await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing cache:', error);
    }
}

async function generateTable() {
    let html = '<table><tr><th>Name</th><th>Dependencies</th><th>License</th><th>Age (Years)</th><th>Stars</th><th>Issues</th><th>Last Commit</th></tr>';
    const cache = await readCache();

    for (const { name, user, repo, dependencies } of repositories) {
        const repoData = await fetchRepoData(user, repo);  // Ensure repoData is declared here
        html += `<tr><td><a href="https://github.com/${user}/${repo}">${name}</a></td><td>${dependencies}</td><td>${repoData.license}</td><td>${repoData.age}</td><td>${repoData.stars}</td><td>${repoData.issues}</td><td>${new Date(repoData.lastCommit).toLocaleDateString()}</td></tr>`;
    }

    html += '</table>';
    html += `<p>Last Updated At: ${new Date().toLocaleString()}</p>`;
    return html;
}

async function writeToFile(content) {
    try {
        await fs.writeFile(outputFilePath, content, 'utf8');
        console.log(`HTML content written to ${outputFilePath}`);
    } catch (error) {
        console.error('Error writing to file:', error);
    }
}

async function generateMarkdownTable() {
    let markdown = '| Name | Dependencies | License | Age (Years) | Stars | Issues | Last Commit |\n';
    markdown += '|------|--------------|---------|-------------|-------|--------|-------------|\n';
    const cache = await readCache();

    for (const { name, user, repo, dependencies } of repositories) {
        const repoData = await fetchRepoData(user, repo);
        markdown += `| [${name}](https://github.com/${user}/${repo}) | ${dependencies} | ${repoData.license} | ${repoData.age} | `;
        markdown += `![Stars](https://img.shields.io/github/stars/${user}/${repo}?style=social) | `;
        markdown += `![Issues](https://img.shields.io/github/issues/${user}/${repo}) | `;
        markdown += `${new Date(repoData.lastCommit).toLocaleDateString()} |\n`;
    }

    markdown += `\n_Last Updated At: ${new Date().toLocaleString()}_\n`;
    return markdown;
}

async function writeToMarkdownFile(content) {
    try {
        await fs.writeFile(markdownOutputFilePath, content, 'utf8');
        console.log(`Markdown content written to ${markdownOutputFilePath}`);
    } catch (error) {
        console.error('Error writing to markdown file:', error);
    }
}

generateMarkdownTable().then(markdown => {
    writeToMarkdownFile(markdown);
}).catch(err => {
    console.error("An error occurred:", err);
});
