(() => {
  const search = document.querySelector("#desktop-search");
  const type = document.querySelector("#desktop-type");
  const status = document.querySelector("#desktop-status");
  const count = document.querySelector("#desktop-count");
  const rows = [...document.querySelectorAll(".list-table .list-row")];
  if (!search || !type || !status || !count) return;
  const normalize = (value) => value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
  const filter = () => {
    const query = normalize(search.value);
    let visible = 0;
    for (const row of rows) {
      row.hidden = Boolean(
        (query && !normalize(row.dataset.search).includes(query)) ||
        (type.value && row.dataset.type !== type.value) ||
        (status.value && row.dataset.status !== status.value)
      );
      if (!row.hidden) visible += 1;
    }
    count.textContent = `${visible} of ${rows.length} repositories`;
  };
  search.addEventListener("input", filter);
  type.addEventListener("change", filter);
  status.addEventListener("change", filter);
  filter();
})();
