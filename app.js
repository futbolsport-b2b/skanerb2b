const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfEUx_3pwBO2oAL1XKE0AYT8sAXplN7IUKngixABjYH9nKcpJk-tCgl3Rv_q6UPCSS5g/exec"; 
let currentOrderID = null;
let currentOffset = 0;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

function resetProductUI() {
    isProcessing = true; 
    document.getElementById("task-card").classList.add("loading-state");
    document.getElementById("task-nazwa-big").innerText = "Wczytywanie...";
    document.getElementById("task-kat-val").innerText = "---";
    document.getElementById("task-qty-val").innerText = "--";
}

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: 250 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.add("ean-mode");
    setCornersColor("white");
    // Wąski obszar skanowania dla EAN
    await html5QrCode.start({ facingMode: "environment" }, { fps: 30, qrbox: {width: 300, height: 110} }, onScan);
}

async function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    // 1. SKAN QR ZAMÓWIENIA
    if (!currentOrderID) {
        isProcessing = true;
        setCornersColor("#30d158");
        playBeep(880, 100);
        
        currentOrderID = code;
        document.getElementById("order-number-val").innerText = currentOrderID;

        setTimeout(async () => {
            await html5QrCode.stop();
            document.getElementById("camera-wrapper").style.display = "none";
            document.getElementById("btn-finish-icon").style.display = "flex";
            fetchNext(0);
        }, 100);
        return;
    }

    // 2. SKAN EAN PRODUKTU
    if (code === targetItem.ean) {
        isProcessing = true;
        setCornersColor("#30d158");
        playBeep(880, 100);
        
        setTimeout(async () => {
            await html5QrCode.stop();
            document.getElementById("camera-wrapper").style.display = "none";
            if (targetItem.pozostalo > 1) showQty();
            else sendVal(1);
        }, 150);
    } else {
        // CZERWONE RAMKI PRZY BŁĘDZIE
        showError("BŁĘDNY PRODUKT", "#ff453a");
    }
}

async function fetchNext(offset) {
    resetProductUI();
    currentOffset = offset;
    
    try {
        const url = `${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`;
        // Zapytanie bez blokowania UI przez długi czas
        const res = await fetch(url).then(r => r.json());
        
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            document.getElementById("task-lp-val").innerText = targetItem.lp;
            document.getElementById("task-nazwa-big").innerText = targetItem.nazwa;
            document.getElementById("task-kat-val").innerText = "KATALOG: " + targetItem.nr_kat;
            document.getElementById("task-qty-val").innerText = targetItem.pozostalo;
            document.getElementById("task-card").classList.remove("loading-state");
            document.getElementById("task-card").style.display = "block";
            isProcessing = false;
        } else if (res.status === "order_finished") {
            alert("ZREALIZOWANO W CAŁOŚCI");
            location.reload();
        }
    } catch (e) {
        isProcessing = false;
        console.error("Fetch error:", e);
    }
}

function showQty() {
    const panel = document.getElementById("qty-panel");
    const input = document.getElementById("qty-input");
    document.getElementById("qty-nazwa-info").innerText = targetItem.nazwa;
    document.getElementById("kat-val-display").innerText = targetItem.nr_kat;
    document.getElementById("qty-remain-val").innerText = targetItem.pozostalo;
    panel.style.display = "flex";
    input.value = "";
    // Błyskawiczne wywołanie klawiatury
    setTimeout(() => { input.focus(); input.click(); }, 30);
}

document.getElementById("btn-qty-ok").onclick = function() {
    const val = document.getElementById("qty-input").value;
    if(!val || val <= 0) return;
    this.disabled = true;
    document.getElementById("qty-panel").style.display = "none";
    sendVal(val);
};

async function sendVal(q) {
    try {
        const url = `${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`;
        const res = await fetch(url).then(r => r.json());
        document.getElementById("btn-qty-ok").disabled = false;
        if (res.status === "success") {
            fetchNext(currentOffset);
        } else {
            showError(res.msg, "#ff453a");
            setTimeout(showQty, 1500);
        }
    } catch (e) { isProcessing = false; }
}

function showError(msg, color) {
    isProcessing = true;
    setCornersColor(color);
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.style.display = "flex";
    document.getElementById("error-text").innerText = msg;
    setTimeout(() => { 
        overlay.style.display = "none"; 
        isProcessing = false; 
        setCornersColor("white");
    }, 1200);
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

function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startQR();
