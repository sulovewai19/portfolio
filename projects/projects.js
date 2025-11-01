import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects } from "../global.js";

async function loadProjects() {
  const basePath =
    window.location.hostname.includes("github.io")
      ? "/portfolio/lib/projects.json"
      : "../lib/projects.json";

  const projects = await fetchJSON(basePath);
  if (!projects) return;

  const container = document.querySelector(".projects");
  const count = document.getElementById("project-count");

  // ====== VARIABLES ======
  let selectedIndex = -1;
  let query = "";

  // ====== PIE CHART RENDER FUNCTION ======
  function renderPieChart(projectsGiven) {
    // Group projects by year
    let rolledData = d3.rollups(
      projectsGiven,
      (v) => v.length,
      (d) => d.year
    );

    let data = rolledData.map(([year, count]) => ({
      value: count,
      label: year
    }));

    // D3 generators
    let svg = d3.select("#projects-pie-plot");
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let sliceGenerator = d3.pie().value((d) => d.value);
    let arcData = sliceGenerator(data);
    let colors = d3.scaleOrdinal(d3.schemeTableau10);

    // Clear old paths + legend
    svg.selectAll("path").remove();
    d3.select(".legend").selectAll("li").remove();

    // Draw pie slices
    arcData.forEach((d, idx) => {
      svg
        .append("path")
        .attr("d", arcGenerator(d))
        .attr("fill", colors(idx))
        .attr("class", idx === selectedIndex ? "selected" : "")
        .on("click", () => {
          selectedIndex = selectedIndex === idx ? -1 : idx;
          updateProjects();
        });
    });

    // Draw legend
    let legend = d3.select(".legend");
    data.forEach((d, idx) => {
      legend
        .append("li")
        .attr("style", `--color:${colors(idx)}`)
        .attr("class", idx === selectedIndex ? "selected" : "")
        .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
        .on("click", () => {
          selectedIndex = selectedIndex === idx ? -1 : idx;
          updateProjects();
        });
    });
  }

  // ====== MAIN UPDATE FUNCTION ======
  function updateProjects() {
    // Start from all projects
    let filtered = [...projects];

    // Apply search filter
    if (query) {
      filtered = filtered.filter((project) => {
        const text = Object.values(project).join(" ").toLowerCase();
        return text.includes(query.toLowerCase());
      });
    }

    // Apply year filter
    if (selectedIndex !== -1) {
      // Regenerate data each time to stay in sync with current search results
      const rolledData = d3.rollups(
        filtered,
        (v) => v.length,
        (d) => d.year
      ).map(([year]) => year);

      const targetYear = rolledData[selectedIndex];
      filtered = filtered.filter((p) => p.year == targetYear);
    }

    // Render everything
    renderProjects(filtered, container, "h2");
    if (count) count.textContent = filtered.length;
    renderPieChart(filtered);
  }

  // ===== INITIAL LOAD =====
  renderProjects(projects, container, "h2");
  if (count) count.textContent = projects.length;
  renderPieChart(projects);

  // ===== SEARCH BAR =====
  const searchBar = document.createElement("input");
  searchBar.type = "search";
  searchBar.className = "searchBar";
  searchBar.placeholder = "🔍 Search projects…";
  container.before(searchBar);

  searchBar.addEventListener("input", (event) => {
    query = event.target.value.toLowerCase();
    updateProjects();
  });
}

loadProjects();
