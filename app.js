// v42.7 (BLUE-SKY) - Terminal Magazynowy - JS
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzQR5-ZYU0eszM_BgW4tzIg_asx7RiQJBWWCshuckTgmFR1exqBqa3l3tDDhrwZez2d/exec"; 
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
const html5QrCode = new Html5Qrcode("reader");

// Funkcja showQty (Fix v42.7): Łączymy Nr Kat i ROZMIAR w jeden ciąg znaków (czysty tekst)
function showQty() {
    const m = document.getElementById("qty-modal");
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    
    // Pobieramy dane
    const kat = targetItem.nr_kat;
    const roz = targetItem.rozmiar || "---";
    
    // Tworzymy jeden czytelny tekst bez tagów HTML, który nie rozwali stylów
    // Przykład: "Nr Kat: 12345 | ROZMIAR: XL"
    document.getElementById("qty-kat-val").innerText = "Nr Kat: " + kat + " | ROZMIAR: " + roz.toUpperCase();
    
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    m.style.display = "flex";
    const i = document.getElementById("qty-input"); i.value = "";
    setTimeout(() => { i.focus(); i.click(); }, 150);
}

// Reszta kodu IDENTYCZNA jak w stabilnej v42.4
async function fetchNext(offset) {
    document.querySelector('.task-card').style.opacity = "0.5";
    isProcessing = true;
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
                document.querySelector('.task-card').style.opacity = "1";
                isProcessing = false;
            }, 350);
        } else { alert("ZREALIZOWANE"); location.reload(); }
    } catch (e) { isProcessing = false; }
}

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
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

async function startEAN() {
    isProcessing = false; document.body.className = "ean-mode";
    document.getElementById("target-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("target-size-val").innerText = targetItem.rozmiar || "---";
    document.getElementById("scanner-instruction").style.display = "block";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => {
        if (res.status === "success") {
            document.getElementById("qty-modal").style.display = "none";
            fetchNext(currentOffset);
        } else { showError(res.msg); }
    });
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
