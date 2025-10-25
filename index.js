import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// ----- LOAD LATEST PROJECTS -----
async function loadLatestProjects() {
  const projects = await fetchJSON('./lib/projects.json');
  if (!projects) return;

  const latestThree = projects.slice(0, 3);
  const container = document.querySelector('.latest-projects');
  renderProjects(latestThree, container, 'h3');
}

// ----- LOAD GITHUB STATS -----
async function loadGitHubStats() {
  const githubData = await fetchGitHubData('sulovewai19');
  if (!githubData) return;

  const profileStats = document.querySelector('#profile-stats');
  if (profileStats) {
    profileStats.innerHTML = `
      <div style="text-align:center;">
        <img src="${githubData.avatar_url}" alt="${githubData.login}" style="width:120px; border-radius:50%; margin-bottom:10px;">
        <p>👤 <strong>Username:</strong> <a href="${githubData.html_url}" target="_blank">${githubData.login}</a></p>
      </div>
      <dl style="margin-top:12px;">
        <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers:</dt><dd>${githubData.followers}</dd>
        <dt>Following:</dt><dd>${githubData.following}</dd>
      </dl>
    `;
  }
}

loadLatestProjects();
loadGitHubStats();
