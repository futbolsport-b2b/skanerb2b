// v42.5 - Terminal Magazynowy - JS
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4CM8RRE_CR5VrA9ulylGkumghptwlKT0t7LlxT2V6BaunlIVLQMlJn6rERr3NOQh8/exec"; 
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
const html5QrCode = new Html5Qrcode("reader");

function setLoadingState(active) {
    const card = document.querySelector('.task-card');
    if (active) { card.classList.add('loading-mode'); isProcessing = true; }
    else { card.classList.remove('loading-mode'); isProcessing = false; }
}

async function fetchNext(offset) {
    setLoadingState(true);
    currentOffset = offset;
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            setTimeout(() => {
                document.getElementById("task-lp").innerText = targetItem.lp;
                document.getElementById("task-name").innerText = targetItem.nazwa;
                document.getElementById("task-kat").innerText = targetItem.nr_kat;
                document.getElementById("task-qty").innerText = targetItem.pozostalo;
                document.getElementById("task-size").innerText = targetItem.rozmiar || "---";

                const notesRow = document.getElementById("task-notes-row");
                if (targetItem.uwagi && targetItem.uwagi.trim() !== "") {
                    document.getElementById("task-notes").innerText = targetItem.uwagi;
                    notesRow.style.display = "block";
                } else { notesRow.style.display = "none"; }

                document.getElementById("task-panel").style.display = "block";
                setLoadingState(false);
            }, 350);
        } else { alert("ZAMÓWIENIE ZREALIZOWANE"); location.reload(); }
    } catch (e) { setLoadingState(false); }
}

function showQty() {
    const m = document.getElementById("qty-modal");
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    
    // Front 4 Update: Nr Kat (niebieski) i Rozmiar (czerwony)
    document.getElementById("qty-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("qty-roz-val").innerText = targetItem.rozmiar || "---";
    
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    
    // Reset przycisku (widoczny tekst, schowany spinner)
    document.getElementById("btn-ok-text").style.display = "inline";
    document.getElementById("btn-ok-spinner").style.display = "none";
    
    m.style.display = "flex";
    const i = document.getElementById("qty-input"); i.value = "";
    setTimeout(() => { i.focus(); i.click(); }, 150);
}

function sendVal(q) {
    if (!q || q <= 0) return;
    
    // Aktywacja spinnera na przycisku
    document.getElementById("btn-ok-text").style.display = "none";
    document.getElementById("btn-ok-spinner").style.display = "block";

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => {
        if (res.status === "success") {
            document.getElementById("qty-modal").style.display = "none";
            fetchNext(currentOffset);
        } else {
            // Reset spinnera w przypadku błędu
            document.getElementById("btn-ok-text").style.display = "inline";
            document.getElementById("btn-ok-spinner").style.display = "none";
            showError(res.msg);
        }
    });
}

// Funkcje skanowania i pomocnicze z v42.4...
function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();
    if (!currentOrderID) {
        isProcessing = true; currentOrderID = code;
        document.getElementById("order-val").innerText = code;
        setTimeout(() => { html5QrCode.stop().then(() => {
            document.getElementById("scanner-box").style.display = "none";
            document.getElementById("btn-finish-icon").style.display = "flex";
            fetchNext(0);
        }); }, 150);
    } else if (code === targetItem.ean) {
        isProcessing = true;
        setTimeout(() => { html5QrCode.stop().then(() => {
            document.getElementById("scanner-box").style.display = "none";
            if (targetItem.pozostalo > 1) showQty(); else sendVal(1);
        }); }, 150);
    } else { showError("BŁĘDNY PRODUKT"); }
}

async function startQR() {
    isProcessing = false; document.body.className = "qr-mode";
    document.getElementById("scanner-instruction").style.display = "none";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

async function startEAN() {
    isProcessing = false; document.body.className = "ean-mode";
    document.getElementById("target-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("target-size-val").innerText = targetItem.rozmiar || "---";
    document.getElementById("scanner-instruction").style.display = "block";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function showError(m) {
    isProcessing = true;
    const o = document.getElementById("error-overlay");
    document.getElementById("error-text").innerText = m;
    o.style.display = "flex";
    setTimeout(() => { o.style.display = "none"; isProcessing = false; }, 1500);
}

document.getElementById("btn-qty-ok").onclick = () => sendVal(document.getElementById("qty-input").value);
document.getElementById("btn-scan-item").onclick = () => { document.getElementById("task-panel").style.display = "none"; document.getElementById("scanner-box").style.display = "block"; startEAN(); };
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

startQR();
