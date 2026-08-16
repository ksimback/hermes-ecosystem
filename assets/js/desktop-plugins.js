(() => {
  const search = document.querySelector("#desktop-search");
  const type = document.querySelector("#desktop-type");
  const status = document.querySelector("#desktop-status");
  const rows = [...document.querySelectorAll(".list-table .list-row")];
  if (!search || !type || !status) return;
  const normalize = (value) => value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
  const filter = () => {
    const query = normalize(search.value);
    for (const row of rows) {
      row.hidden = Boolean(
        (query && !normalize(row.dataset.search).includes(query)) ||
        (type.value && row.dataset.type !== type.value) ||
        (status.value && row.dataset.status !== status.value)
      );
    }
  };
  search.addEventListener("input", filter);
  type.addEventListener("change", filter);
  status.addEventListener("change", filter);
})();
