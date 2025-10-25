import { fetchJSON, renderProjects } from '../global.js';

async function loadProjects() {
  const basePath =
    window.location.hostname.includes('github.io')
      ? '/portfolio/lib/projects.json'   
      : '../lib/projects.json';          

  const projects = await fetchJSON(basePath);
  if (!projects) return;

  const container = document.querySelector('.projects');
  renderProjects(projects, container, 'h2');

  const count = document.getElementById('project-count');
  if (count) count.textContent = projects.length;
}

loadProjects();
