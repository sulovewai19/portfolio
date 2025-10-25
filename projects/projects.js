import { fetchJSON, renderProjects } from '../global.js';

async function loadProjects() {
  const projects = await fetchJSON('../lib/projects.json');
  if (!projects) return;

  const container = document.querySelector('.projects');
  renderProjects(projects, container, 'h2');

  const count = document.getElementById('project-count');
  if (count) count.textContent = projects.length;
}

loadProjects();


