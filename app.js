const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiqacaq2aSakr6YOZm3W9wXXGrWibtWOn13yuFbKlqFfo3BrsvQcZIBaIKTUCWTZg9OQ/exec";
let currentOrderID = null;
let currentOffset = 0;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.add("ean-mode");
    setCornersColor("white"); // Upewnij się, że startujemy z białym
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

async function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    // PROCEDURA: KOD ZAMÓWIENIA
    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            isProcessing = true;
            setCornersColor("#30d158"); // Zielone ramki
            playBeep(880, 100);
            currentOrderID = code;
            document.getElementById("order-number-val").innerText = currentOrderID;
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    document.getElementById("btn-finish-icon").style.display = "flex";
                    fetchNext(0);
                });
            }, 200);
        }
        return;
    }

    // PROCEDURA: KOD EAN PRODUKTU
    if (currentOrderID) {
        if (code === targetItem.ean) {
            isProcessing = true;
            setCornersColor("#30d158"); // ZIELONE RAMKI NA EAN
            playBeep(880, 100);
            
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    if (targetItem.pozostalo > 1) {
                        showQty();
                    } else {
                        sendVal(1);
                    }
                });
            }, 200);
        } else {
            // CZERWONE RAMKI NA EAN PRZY BŁĘDZIE
            showError("BŁĘDNY PRODUKT", "#ff453a");
        }
    }
}

async function fetchNext(offset) {
    currentOffset = offset;
    document.getElementById("task-nazwa-big").innerText = "Wczytywanie...";
    document.getElementById("task-card").style.display = "block";

    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&action=get_next&offset=${offset}`).then(r => r.json());
        isProcessing = false;
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            document.getElementById("task-lp-val").innerText = targetItem.lp;
            document.getElementById("task-nazwa-big").innerText = targetItem.nazwa;
            document.getElementById("task-kat-val").innerText = targetItem.nr_kat;
            document.getElementById("task-qty-val").innerText = targetItem.pozostalo;
        } else {
            alert("ZREALIZOWANO W CAŁOŚCI");
            location.reload();
        }
    } catch (e) { isProcessing = false; }
}

function showQty() {
    const panel = document.getElementById("qty-panel");
    const input = document.getElementById("qty-input");
    const btn = document.getElementById("btn-qty-ok");
    
    // Wypełnij dane w pancernej karcie ilości
    document.getElementById("qty-nazwa-info").innerText = targetItem.nazwa;
    document.getElementById("qty-kat-info").innerHTML = `Nr Kat: <span id="kat-val-display">${targetItem.nr_kat}</span>`;
    document.getElementById("qty-remain-val").innerText = targetItem.pozostalo;
    
    btn.classList.remove("loading");
    panel.style.display = "block";
    input.value = ""; // Puste pole
    
    // Agresywny focus dla iOS
    requestAnimationFrame(() => {
        input.focus();
        setTimeout(() => input.click(), 10);
    });
}

document.getElementById("btn-qty-ok").onclick = function() {
    const val = document.getElementById("qty-input").value;
    if(!val || val <= 0) return;
    this.classList.add("loading");
    sendVal(val);
};

document.getElementById("btn-qty-cancel").onclick = function() {
    document.getElementById("qty-panel").style.display = "none";
    fetchNext(currentOffset); // Wróć do karty produktu
};

async function sendVal(q) {
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&ean=${targetItem.ean}&qty=${q}&action=validate`).then(r => r.json());
        if (res.status === "success") {
            document.getElementById("qty-panel").style.display = "none";
            fetchNext(currentOffset);
        } else {
            // Obsługa błędu ilościowego ("PRZEKROCZONO ILOŚĆ")
            document.getElementById("btn-qty-ok").classList.remove("loading");
            showError(res.msg, "#ff453a");
            isProcessing = false;
            // Panel ilości ZOSTAJE OTWARTY, by poprawić liczbę
        }
    } catch (e) { isProcessing = false; }
}

function showError(msg, cornerColor) {
    isProcessing = true;
    setCornersColor(cornerColor); // Ustaw kolor ramek (EAN zrobi się czerwony)
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.innerText = msg;
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
        if(cornerColor === "#ff453a" && !currentOrderID) setCornersColor("white"); // Reset tylko dla QR
    }, 1500);
}

function setCornersColor(color) {
    document.querySelectorAll('.corner').forEach(c => c.style.borderColor = color);
}

document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    document.getElementById("camera-wrapper").style.display = "block";
    startEAN();
};

document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };

function playBeep(f, d) { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startQR();
