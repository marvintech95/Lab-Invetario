const state = {
  rawData: null,
  rows: [],
  filteredRows: []
};

const els = {
  searchInput: document.getElementById("searchInput"),
  gaveteiroFilter: document.getElementById("gaveteiroFilter"),
  statusFilter: document.getElementById("statusFilter"),
  tableBody: document.getElementById("inventoryTableBody"),
  summaryCount: document.getElementById("summaryCount"),
  summaryEmpty: document.getElementById("summaryEmpty"),
  summaryRevision: document.getElementById("summaryRevision"),
  messageArea: document.getElementById("messageArea")
};

function normalizeText(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateStatus(qty) {
  if (qty === 0) return "CRITICO";
  if (qty <= 2) return "BAIXO";
  return "OK";
}

function flattenInventory(data) {
  const rows = [];
  const inventario = data?.inventario || [];

  inventario.forEach((gaveteiro, gavIdx) => {
    const gaveteiroName = gaveteiro.gaveteiro || `Gaveteiro ${String(gavIdx + 1).padStart(2, "0")}`;
    const loc = gaveteiro.localizacao_detalhada || "";
    const secoes = gaveteiro.secoes || [];

    secoes.forEach((secao, secIdx) => {
      const secaoName = secao.nome_secao || `Seção ${String(secIdx + 1).padStart(2, "0")}`;
      const gavetas = secao.gavetas || [];

      gavetas.forEach((gaveta, gavetaIdx) => {
        const gavetaName = gaveta.nome_gaveta || `Gaveta ${String(gavetaIdx + 1).padStart(2, "0")}`;
        const codigoBase = gaveta.codigo || `GV${String(gavIdx + 1).padStart(2, "0")}-S${String(secIdx + 1).padStart(2, "0")}-G${String(gavetaIdx + 1).padStart(2, "0")}`;
        const componentes = gaveta.componentes || [];

        componentes.forEach((comp, compIdx) => {
          const quantidade = Number(comp.quantidade ?? 0);

          rows.push({
            id: `${codigoBase}-${String(compIdx + 1).padStart(2, "0")}`,
            codigo: codigoBase,
            componente: comp.componente || "",
            quantidade,
            gaveteiro: gaveteiroName,
            localizacao_detalhada: loc,
            secao: secaoName,
            gaveta: gavetaName,
            status: comp.status || calculateStatus(quantidade),
            data_revisao: secao.data_revisao || ""
          });
        });
      });
    });
  });

  return rows;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    return normalizeText(a.codigo).localeCompare(normalizeText(b.codigo), "pt-BR");
  });
}

function getUniqueGaveteiros(rows) {
  return [...new Set(rows.map(r => r.gaveteiro))].sort((a, b) =>
    normalizeText(a).localeCompare(normalizeText(b), "pt-BR")
  );
}

function populateGaveteiroFilter() {
  const gaveteiros = getUniqueGaveteiros(state.rows);
  els.gaveteiroFilter.innerHTML = `<option value="">Todos os gaveteiros</option>`;

  gaveteiros.forEach(gaveteiro => {
    const option = document.createElement("option");
    option.value = gaveteiro;
    option.textContent = gaveteiro;
    els.gaveteiroFilter.appendChild(option);
  });
}

function applyFilters() {
  const q = normalizeText(els.searchInput.value);
  const gaveteiro = normalizeText(els.gaveteiroFilter.value);
  const status = normalizeText(els.statusFilter.value);

  state.filteredRows = state.rows.filter(row => {
    const haystack = normalizeText([
      row.codigo,
      row.componente,
      row.gaveteiro,
      row.secao,
      row.gaveta,
      row.localizacao_detalhada
    ].join(" "));

    const matchQuery = !q || haystack.includes(q);
    const matchGaveteiro = !gaveteiro || normalizeText(row.gaveteiro) === gaveteiro;
    const matchStatus = !status || normalizeText(row.status) === status;

    return matchQuery && matchGaveteiro && matchStatus;
  });

  renderTable();
  renderSummary();
}

function renderTable() {
  els.tableBody.innerHTML = "";

  if (!state.filteredRows.length) {
    els.messageArea.textContent = "Nenhum item encontrado.";
    return;
  }

  els.messageArea.textContent = "";

  const fragment = document.createDocumentFragment();

  state.filteredRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.className = `status-${normalizeText(row.status).toLowerCase()}`;

    tr.innerHTML = `
      <td>${row.codigo}</td>
      <td>${row.componente}</td>
      <td>${row.quantidade}</td>
      <td>${row.gaveteiro}</td>
      <td>${row.secao}</td>
      <td>${row.gaveta}</td>
    `;

    fragment.appendChild(tr);
  });

  els.tableBody.appendChild(fragment);
}

function renderSummary() {
  const total = state.filteredRows.length;
  const emptyCount = state.filteredRows.filter(r => r.quantidade === 0).length;
  const latestRevision = state.filteredRows.find(r => r.data_revisao)?.data_revisao || "--";

  els.summaryCount.textContent = `${total} itens`;
  els.summaryEmpty.textContent = `${emptyCount} vazios`;
  els.summaryRevision.textContent = `Revisão: ${latestRevision}`;
}

async function loadInventory() {
  try {
    const response = await fetch("inventario.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    state.rawData = await response.json();
    state.rows = sortRows(flattenInventory(state.rawData));
    state.filteredRows = [...state.rows];

    populateGaveteiroFilter();
    renderTable();
    renderSummary();
  } catch (error) {
    els.messageArea.textContent = `Erro ao carregar inventário: ${error.message}`;
  }
}

els.searchInput.addEventListener("input", applyFilters);
els.gaveteiroFilter.addEventListener("change", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);

document.addEventListener("DOMContentLoaded", loadInventory);
