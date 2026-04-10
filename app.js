const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx06U7EvMM6r8FCU3F5g5ODcjIGen0k7TWZ9aQQxgex6WTXLUTpuDt_kciLWru1jsKnqg/exec";

let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

// Start skanera QR
async function startOrderScanner() {
    document.getElementById("camera-wrapper").style.display = "block";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, onScanSuccess);
}

// Start skanera EAN (wąski)
async function startEanScanner() {
    if (html5QrCode.isScanning) await html5QrCode.stop();
    document.body.classList.add("scanning-ean");
    document.getElementById("camera-wrapper").style.display = "block";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: {width: 300, height: 100}, aspectRatio: 3.0 }, onScanSuccess);
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    // 1. SKANOWANIE ZAMÓWIENIA
    if (!currentOrderID) {
        currentOrderID = code;
        document.getElementById("btn-exit").style.display = "block";
        fetchNextItem();
        return;
    }

    // 2. SKANOWANIE PRODUKTU
    if (currentOrderID) {
        if (code === targetItem.ean) {
            isProcessing = true;
            playBeep(880, 100);
            html5QrCode.stop();
            document.getElementById("camera-wrapper").style.display = "none";
            
            if (targetItem.pozostalo > 1) {
                document.getElementById("qty-section").style.display = "block";
                setTimeout(() => document.getElementById("quantity-input").focus(), 200);
            } else {
                sendData(1); // Automatycznie 1 sztuka
            }
        } else {
            updateStatus("BŁĘDNY PRODUKT!");
            playBeep(200, 500);
        }
    }
}

function fetchNextItem() {
    updateStatus("Pobieranie zadania...");
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "next_item") {
                targetItem = res;
                showTaskCard(res);
            } else {
                alert(res.msg);
                location.reload();
            }
        });
}

function showTaskCard(item) {
    document.getElementById("camera-wrapper").style.display = "none";
    document.getElementById("task-card").style.display = "block";
    document.getElementById("order-title").innerText = "ZAM: " + currentOrderID;
    document.getElementById("task-lp").innerText = item.lp;
    document.getElementById("task-nazwa").innerText = item.nazwa;
    document.getElementById("task-kat").innerText = item.nr_kat;
    document.getElementById("task-qty").innerText = item.pozostalo + " szt.";
    updateStatus("Udaj się do produktu");
}

document.getElementById("btn-open-scanner").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    startEanScanner();
    updateStatus("Zeskanuj kod EAN produktu");
};

document.getElementById("btn-confirm-qty").onclick = () => {
    const q = document.getElementById("quantity-input").value;
    sendData(q);
};

function sendData(qty) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${qty}&action=validate`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success") {
                document.getElementById("qty-section").style.display = "none";
                isProcessing = false;
                fetchNextItem(); // Pobierz kolejny produkt
            } else {
                alert(res.msg);
                isProcessing = false;
            }
        });
}

function updateStatus(m) { document.getElementById("status-msg").innerText = m; }
function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startOrderScanner();
