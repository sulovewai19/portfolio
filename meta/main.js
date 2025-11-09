import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------------- Load Data ----------------
async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    datetime: new Date(row.datetime),
  }));
  return data;
}

// ---------------- Process Commits ----------------
function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const { author, date, time, timezone, datetime } = first;

    const ret = {
      id: commit,
      url: `https://github.com/YOUR_REPO/commit/${commit}`, // optional
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(ret, "lines", {
      value: lines,
      enumerable: false,
    });
    return ret;
  });
}

// ---------------- Render Stats ----------------
function renderStats(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  dl.append("dt").html('Total <abbr title="Lines of Code">LOC</abbr>');
  dl.append("dd").text(data.length);

  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  const maxDepth = d3.max(data, (d) => d.depth);
  dl.append("dt").text("Maximum code depth");
  dl.append("dd").text(maxDepth);
}

// ---------------- Render Scatterplot ----------------
function renderScatterPlot(commits) {
  const width = 1000,
    height = 600,
    margin = { top: 20, right: 30, bottom: 40, left: 50 };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("overflow", "visible");

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([margin.left, width - margin.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  const rScale = d3
    .scaleSqrt()
    .domain(d3.extent(commits, (d) => d.totalLines))
    .range([3, 25]);

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

  // Gridlines
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat("")
        .tickSize(-width + margin.left + margin.right)
    );

  // Draw dots
  const dots = svg.append("g").attr("class", "dots");

  dots
    .selectAll("circle")
    .data(d3.sort(commits, (d) => -d.totalLines)) // smaller on top
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("opacity", 0.8);

  // Brush setup
  const brush = d3.brush().on("start brush end", brushed);
  svg.append("g").call(brush).lower();

  function brushed(event) {
    const selection = event.selection;
    const circles = svg.selectAll("circle");

    if (selection) {
      const [[x0, y0], [x1, y1]] = selection;
      circles.classed("selected", (d) => {
        const cx = xScale(d.datetime);
        const cy = yScale(d.hourFrac);
        return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
      });
    } else {
      circles.classed("selected", false);
    }

    const selected = circles.filter(".selected").data();
    renderSelectionCount(selected);
    renderLanguageBreakdown(selected);
  }
}

// ---------------- Selection Count ----------------
function renderSelectionCount(selected) {
  let p = d3.select("#selection-count");
  if (p.empty()) {
    p = d3.select("#chart").append("p").attr("id", "selection-count");
  }
  p.text(
    selected.length
      ? `${selected.length} commits selected`
      : "No commits selected"
  );
}

// ---------------- Language Breakdown ----------------
function renderLanguageBreakdown(selected) {
  let dl = d3.select("#language-breakdown");
  if (dl.empty()) {
    dl = d3
      .select("#chart")
      .append("dl")
      .attr("id", "language-breakdown")
      .attr("class", "stats");
  }

  dl.html("");
  if (!selected.length) return;

  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);
    dl.append("dt").text(language.toUpperCase());
    dl.append("dd").text(`${count} lines (${formatted})`);
  }
}

const data = await loadData();
const commits = processCommits(data);
renderStats(data, commits);
renderScatterPlot(commits);

