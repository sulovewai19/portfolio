import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// ---------- Global state ----------
let allLines = [];
let commits = [];
let filteredCommits = [];

// slider / time scale
let commitProgress = 100;
let timeScale;
let commitMaxTime;

// scales reused by render & update
let xScale;
let yScale;

// ---------- Data loading ----------
async function loadData() {
  const data = await d3.csv("./loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  const grouped = d3.groups(data, (d) => d.commit);

  const commits = grouped.map(([commit, lines]) => {
    const first = lines[0];
    const datetime = first.datetime;

    const ret = {
      id: commit,
      commit,
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    // attach full line list (non-enumerable)
    Object.defineProperty(ret, "lines", {
      value: lines,
      enumerable: false,
    });

    return ret;
  });

  // sort chronologically for scrollytelling
  commits.sort((a, b) => a.datetime - b.datetime);
  return commits;
}

// ---------- Stats panel ----------
function renderStats(data, commits) {
  const totalLoc = data.length;
  const totalCommits = commits.length;

  const files = d3.rollups(data, (D) => D.length, (d) => d.file);
  const totalFiles = files.length;

  const dates = commits.map((d) => d.datetime);
  const firstDate = d3.min(dates);
  const lastDate = d3.max(dates);
  const daysSpan = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  const avgFileLength = d3.mean(files, ([, lines]) => lines) ?? 0;

  const entries = [
    ["Total LOC", totalLoc.toLocaleString()],
    ["Total commits", totalCommits.toLocaleString()],
    ["Total files", totalFiles.toLocaleString()],
    ["Days since first commit", daysSpan.toString()],
    ["Average file length (lines)", avgFileLength.toFixed(2)],
  ];

  d3.selectAll("#stats-box .stat-item")
    .data(entries)
    .html(
      (d) => `
      <dt>${d[0]}</dt>
      <dd>${d[1]}</dd>
    `
    );
}

// ---------- Scatter plot ----------
function renderScatterPlot(commitsToShow) {
  const width = 700;
  const height = 400;
  const margin = { top: 10, right: 20, bottom: 30, left: 50 };

  const usableArea = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img");

  // scales
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right]);

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 25]);

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // horizontal gridlines
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat("")
        .tickSize(-width + margin.left + margin.right)
    );

  svg.append("g").attr("class", "dots");

  updateScatterPlot(commitsToShow, rScale);
}

function updateScatterPlot(commitsToShow, rScale) {
  const svg = d3.select("#chart svg");
  if (svg.empty()) return;

  if (!rScale) {
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 25]);
  }

  // update time domain for visible commits
  if (commitsToShow.length) {
    xScale.domain(d3.extent(commitsToShow, (d) => d.datetime));
  }

  const xAxis = d3.axisBottom(xScale);
  svg.select("g.x-axis").call(xAxis);

  const dotsGroup = svg.select("g.dots");

  const sorted = d3.sort(commitsToShow, (d) => -d.totalLines);

  dotsGroup
    .selectAll("circle")
    .data(sorted, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("r", 0)
          .attr("fill", "steelblue")
          .attr("opacity", 0.8)
          .call((sel) =>
            sel
              .transition()
              .duration(300)
              .attr("r", (d) => rScale(d.totalLines))
          ),
      (update) =>
        update.call((sel) =>
          sel
            .transition()
            .duration(300)
            .attr("cx", (d) => xScale(d.datetime))
            .attr("cy", (d) => yScale(d.hourFrac))
            .attr("r", (d) => rScale(d.totalLines))
        ),
      (exit) =>
        exit.call((sel) =>
          sel.transition().duration(200).attr("r", 0).remove()
        )
    );

  // update selection text (no brushing, so just count points)
  const selP = d3.select("#selection-count");
  selP.text(
    commitsToShow.length
      ? `${commitsToShow.length} commits shown`
      : "No commits selected"
  );
}

// ---------- Unit visualization ----------
function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append("div").call((div) => {
          div.append("dt").append("code");
          div.append("dd");
        })
    );

  filesContainer
    .select("dt > code")
    .html((d) => `${d.name}<br><small>${d.lines.length} lines</small>`);

  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc");
}

// ---------- Slider ----------
function setupSlider() {
  const slider = document.querySelector("#commit-progress");
  const timeEl = document.querySelector("#commit-time");

  timeScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);

  function onTimeSliderChange() {
    commitProgress = +slider.value;
    commitMaxTime = timeScale.invert(commitProgress);

    timeEl.textContent = commitMaxTime.toLocaleString("en", {
      dateStyle: "long",
      timeStyle: "short",
    });

    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

    updateScatterPlot(filteredCommits);
    updateFileDisplay(filteredCommits);
  }

  slider.addEventListener("input", onTimeSliderChange);

  // initialize
  commitMaxTime = timeScale.invert(commitProgress);
  slider.value = commitProgress;
  onTimeSliderChange();
}

// ---------- Scrollytelling ----------
function buildScatterStory() {
  const container = d3.select("#scatter-story");

  container
  .selectAll(".step")
  .data(commits)
  .join("div")
  .attr("class", "step")
  .html((d, i) => {
    const dateStr = d.datetime.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const filesTouched = d3.rollups(
      d.lines,
      (D) => D.length,
      (l) => l.file
    ).length;

    const intro =
      i === 0 ? "my first commit" : "another commit";

    return `
      <p>
        On ${dateStr}, I made ${intro}. 
        I edited ${d.totalLines} lines across ${filesTouched} ${
      filesTouched === 1 ? "file" : "files"
    }.
      </p>
    `;
  });

}

function setupScrollytelling() {
  function onStepEnter(response) {
    const commit = response.element.__data__;
    if (!commit) return;

    commitMaxTime = commit.datetime;
    commitProgress = timeScale(commitMaxTime);

    const slider = document.querySelector("#commit-progress");
    const timeEl = document.querySelector("#commit-time");

    if (slider) slider.value = commitProgress;
    if (timeEl) {
      timeEl.textContent = commitMaxTime.toLocaleString("en", {
        dateStyle: "long",
        timeStyle: "short",
      });
    }

    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

    updateScatterPlot(filteredCommits);
    updateFileDisplay(filteredCommits);
  }

  const scroller = scrollama();
  scroller
    .setup({
      container: "#scrolly-1",
      step: "#scrolly-1 .step",
      offset: 0.5,
    })
    .onStepEnter(onStepEnter);

  window.addEventListener("resize", () => scroller.resize());
}

// ---------- Init ----------
async function init() {
  allLines = await loadData();
  commits = processCommits(allLines);

  // you can plug in your actual repo if you want
  commits.forEach((c) => {
    c.url =
      c.url ??
      "https://github.com/sulovewai19/portfolio/commit/" + encodeURIComponent(c.id);
  });

  renderStats(allLines, commits);
  renderScatterPlot(commits);

  // initial filtered state = all commits
  filteredCommits = commits.slice();
  updateFileDisplay(filteredCommits);

  setupSlider();
  buildScatterStory();
  setupScrollytelling();
}

init();
