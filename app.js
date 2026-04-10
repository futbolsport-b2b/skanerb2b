const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx9haFfrcW0W9qGrVdUouQBLIumXE57MXWZDcGTBMiaOhUTGlsxs1lLw3zE9SGgnwOOxQ/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

// 1. START: Skanowanie QR zamówienia
async function initOrderScanner() {
    isProcessing = false;
    document.body.classList.remove("ean-active");
    document.getElementById("camera-wrapper").style.display = "block";
    const config = { fps: 20, qrbox: { width: 280, height: 280 } };
    await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

// 2. SKANER PRODUKTÓW
async function startEanScanner() {
    isProcessing = false; // Reset blokady
    document.body.classList.add("ean-active");
    document.getElementById("camera-wrapper").style.display = "block";
    const config = { 
        fps: 25, 
        qrbox: { width: 320, height: 120 },
        aspectRatio: 1.77 
    };
    await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

async function onScanSuccess(decodedText) {
    if (isProcessing) return; // Natychmiastowa blokada wielokrotnego skanu

    const code = decodedText.trim();

    // PROCEDURA: KOD ZAMÓWIENIA
    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            isProcessing = true;
            playBeep(880, 100);
            await html5QrCode.stop();
            document.getElementById("camera-wrapper").style.display = "none";
            document.getElementById("btn-finish-order").style.display = "block";
            document.getElementById("order-title").innerText = "ZAMÓWIENIE ZNALEZIONE";
            currentOrderID = code;
            fetchNextItem();
        }
        return;
    }

    // PROCEDURA: KOD EAN PRODUKTU
    if (currentOrderID) {
        if (code === targetItem.ean) {
            isProcessing = true; // Zatrzymanie logiczne
            playBeep(880, 100);
            
            // ZATRZYMANIE SKANERA (Kamery)
            await html5QrCode.stop();
            document.getElementById("camera-wrapper").style.display = "none";

            if (targetItem.pozostalo > 1) {
                // Procedura dla ilości > 1
                showQtyPanel();
            } else {
                // Procedura dla ilości = 1 (automatyczne przejście)
                sendValidation(1);
            }
        } else {
            // Procedura dla błędnego kodu
            updateStatus("BŁĘDNY KOD PRODUKTU!");
            playBeep(200, 500);
            flashUI("#ff453a");
        }
    }
}

function fetchNextItem() {
    updateStatus("Pobieranie pozycji...");
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(res => res.json())
        .then(res => {
            isProcessing = false;
            if (res.status === "next_item") {
                targetItem = res;
                displayTask(res);
            } else if (res.status === "order_finished") {
                alert(res.msg);
                location.reload();
            }
        });
}

function displayTask(item) {
    document.getElementById("task-card").style.display = "block";
    document.getElementById("task-lp").innerText = item.lp;
    document.getElementById("task-nazwa").innerText = item.nazwa;
    document.getElementById("task-kat").innerText = "NR KAT: " + item.nr_kat;
    document.getElementById("task-qty").innerText = item.pozostalo + " szt.";
}

document.getElementById("btn-trigger-scan").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    startEanScanner();
};

function showQtyPanel() {
    document.getElementById("qty-panel").style.display = "block";
    const input = document.getElementById("quantity-input");
    input.value = 1;
    setTimeout(() => { input.focus(); input.select(); }, 200);
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    sendValidation(qty);
};

function sendValidation(qty) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${qty}&action=validate`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success") {
                document.getElementById("qty-panel").style.display = "none";
                flashUI("#30d158");
                fetchNextItem();
            } else {
                updateStatus(res.msg); // "ZŁA ILOŚĆ WYDANIA!"
                playBeep(200, 600);
                flashUI("#ff453a");
                // Panel ilości zostaje otwarty do poprawy
            }
        });
}

function updateStatus(m) { document.getElementById("status-msg").innerText = m; }
function flashUI(c) { document.body.style.background = c; setTimeout(() => document.body.style.background = "#000", 800); }
function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

initOrderScanner();
