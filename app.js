const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMQt-nGhD87nTSiV5XH57i5c9zm3ikzBJuNI0Ti9jbVWCii86IJqxh7XoOO7sufQsMoA/exec";
let currentOrderID = null;
let currentOffset = 0;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.add("ean-mode");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            isProcessing = true;
            currentOrderID = code;
            document.getElementById("order-number-val").innerText = currentOrderID;
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    document.getElementById("btn-finish-icon").style.display = "flex";
                    fetchNext(0);
                });
            }, 100);
        }
    } else {
        if (code === targetItem.ean) {
            isProcessing = true;
            playBeep(880, 100);
            if (targetItem.pozostalo > 1) {
                showQty();
            } else {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    sendVal(1);
                });
            }
        } else {
            showError("BŁĘDNY PRODUKT");
        }
    }
}

async function fetchNext(offset) {
    currentOffset = offset;
    const card = document.getElementById("task-card");
    document.getElementById("task-nazwa-big").innerText = "Wczytywanie...";
    card.style.display = "block";

    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&action=get_next&offset=${offset}`).then(r => r.json());
        isProcessing = false;
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            document.getElementById("task-lp-val").innerText = targetItem.lp;
            document.getElementById("task-nazwa-big").innerText = targetItem.nazwa;
            document.getElementById("task-kat-val").innerText = "KATALOG: " + targetItem.nr_kat;
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
    
    document.getElementById("qty-remain-val").innerText = targetItem.pozostalo;
    btn.classList.remove("loading");
    panel.style.display = "block";
    input.value = "";
    
    setTimeout(() => { 
        input.focus(); 
        input.click(); 
    }, 50);
}

document.getElementById("btn-qty-ok").onclick = function() {
    const val = document.getElementById("qty-input").value;
    if(!val || val <= 0) return;
    
    this.classList.add("loading"); // Zmiana koloru na aktywny
    
    setTimeout(() => {
        document.getElementById("qty-panel").style.display = "none";
        sendVal(val);
    }, 100);
};

async function sendVal(q) {
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&ean=${targetItem.ean}&qty=${q}&action=validate`).then(r => r.json());
        if (res.status === "success") {
            fetchNext(currentOffset); // Pobierz następny (lub odśwież aktualny offset)
        } else {
            showError(res.msg);
            isProcessing = false;
            showQty();
        }
    } catch (e) { isProcessing = false; }
}

// Nawigacja
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);

function showError(msg) {
    isProcessing = true;
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.innerText = msg;
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
    }, 1500);
}

document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    document.getElementById("camera-wrapper").style.display = "block";
    startEAN();
};

document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };
function playBeep(f, d) { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startQR();
