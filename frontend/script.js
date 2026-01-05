const elExpr = document.getElementById("expr");
const elValue = document.getElementById("value");
const elHistory = document.getElementById("history");
const elApiBase = document.getElementById("apiBase");
const elStatus = document.getElementById("status");

document.getElementById("refreshBtn").addEventListener("click", loadHistory);
document.getElementById("clearBtn").addEventListener("click", clearHistory);

document.querySelector(".keypad").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const digit = btn.dataset.digit;
  const op = btn.dataset.op;
  const action = btn.dataset.action;

  if (digit !== undefined) inputDigit(digit);
  else if (op !== undefined) chooseOp(op);
  else if (action) doAction(action);
});

let current = "0";     // что на дисплее (вводимое число)
let a = null;          // первый операнд
let op = null;         // операция
let overwrite = true;  // надо ли перезаписать current при следующем вводе

function apiBase() {
  const v = (elApiBase.value || "").trim();
  // если пусто — работаем через текущий хост, /api проксирует nginx
  return (v || "").replace(/\/+$/, "");
}


function setStatus(msg) {
  elStatus.textContent = msg || "";
  if (msg) setTimeout(() => (elStatus.textContent = ""), 3500);
}

function updateDisplay() {
  elValue.textContent = current;
  elExpr.textContent = makeExprPreview();
}

function makeExprPreview() {
  if (a === null || op === null) return " ";
  const opSym = opSymbol(op);
  return `${niceNumber(a)} ${opSym} ${overwrite ? "" : current}`;
}

function inputDigit(d) {
  if (overwrite) {
    current = d;
    overwrite = false;
  } else {
    if (current === "0") current = d;
    else current += d;
  }
  updateDisplay();
}

function doAction(action) {
  if (action === "clear") {
    a = null; op = null; current = "0"; overwrite = true;
    updateDisplay();
    return;
  }
  if (action === "backspace") {
    if (overwrite) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    updateDisplay();
    return;
  }
  if (action === "dot") {
    if (overwrite) { current = "0."; overwrite = false; }
    else if (!current.includes(".")) current += ".";
    updateDisplay();
    return;
  }
  if (action === "sign") {
    if (current === "0") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
    updateDisplay();
    return;
  }
  if (action === "equal") {
    void pressEqual();
    return;
  }
}

function chooseOp(nextOp) {
  const curVal = parseFloat(current);

  if (a === null) {
    a = curVal;
    op = nextOp;
    overwrite = true;
    updateDisplay();
    return;
  }

  // если операция уже выбрана и пользователь вводит второе число — считаем промежуточно
  if (!overwrite) {
    const b = curVal;
    const local = localCalc(a, b, op);
    if (local.error) {
      setStatus(`Ошибка: ${local.error}`);
      return;
    }
    a = local.result;
    current = niceNumber(a);
    overwrite = true;
  }

  op = nextOp;
  updateDisplay();
}

async function pressEqual() {
  if (a === null || op === null) return;

  const b = parseFloat(current);
  const aVal = a;

  // UI: если пользователь нажал "=" сразу после операции, считаем a op a (как на многих калькуляторах)
  const bVal = overwrite ? aVal : b;

  try {
    const res = await fetch(`${apiBase()}/api/calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: aVal, b: bVal, op })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "Request failed");

    current = niceNumber(data.result);
    a = data.result;
    overwrite = true;
    setStatus("OK: сохранено в историю");
    updateDisplay();
    await loadHistory();
  } catch (e) {
    setStatus(`Ошибка: ${e.message}`);
  }
}

function localCalc(a, b, op) {
  if (op === "+") return { result: a + b };
  if (op === "-") return { result: a - b };
  if (op === "*") return { result: a * b };
  if (op === "/") {
    if (b === 0) return { error: "Division by zero" };
    return { result: a / b };
  }
  return { error: "Unsupported op" };
}

async function loadHistory() {
  try {
    const res = await fetch(`${apiBase()}/api/history?limit=50`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "Request failed");
    renderHistory(data);
  } catch (e) {
    setStatus(`История: ${e.message}`);
  }
}

async function clearHistory() {
  try {
    const res = await fetch(`${apiBase()}/api/history`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "Request failed");
    renderHistory([]);
    setStatus("История очищена");
  } catch (e) {
    setStatus(`Очистка: ${e.message}`);
  }
}

function renderHistory(items) {
  if (!items || items.length === 0) {
    elHistory.innerHTML = `<div class="muted">История пуста.</div>`;
    return;
  }
  elHistory.innerHTML = items.map((it) => {
    const expr = `${niceNumber(it.a)} ${opSymbol(it.op)} ${niceNumber(it.b)} = ${niceNumber(it.result)}`;
    const time = formatTime(it.created_at);
    return `
      <div class="item">
        <div class="expr">${escapeHtml(expr)}</div>
        <div class="time">${escapeHtml(time)}</div>
      </div>
    `;
  }).join("");
}

function opSymbol(op){
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return op;
}

function formatTime(iso){
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

function niceNumber(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* Keyboard support */
window.addEventListener("keydown", (e) => {
  const k = e.key;

  if (k >= "0" && k <= "9") return inputDigit(k);
  if (k === ".") return doAction("dot");
  if (k === "Backspace") return doAction("backspace");
  if (k === "Escape") return doAction("clear");
  if (k === "Enter" || k === "=") return doAction("equal");

  if (k === "+" || k === "-" || k === "*" || k === "/") return chooseOp(k);
});

updateDisplay();
loadHistory();
