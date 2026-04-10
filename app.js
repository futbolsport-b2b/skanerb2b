const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby1kurmSTZO-_3yBoZ8sw2d35pE38xfAmJ-9EIm_TSboaAV3UFzMQ5sEqR1IoZDIcBQxQ/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

// 1. START: Skanowanie QR zamówienia
async function initOrderScanner() {
    document.body.classList.remove("ean-mode");
    document.getElementById("camera-wrapper").style.display = "block";
    await html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 20, qrbox: 250 }, 
        onScanSuccess
    );
}

// 2. SKANER EAN: Wąski celownik
async function startEanScanner() {
    if (html5QrCode.isScanning) await html5QrCode.stop();
    document.body.classList.add("ean-mode");
    document.getElementById("camera-wrapper").style.display = "block";
    await html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 25, qrbox: {width: 320, height: 100}, aspectRatio: 3.2 }, 
        onScanSuccess
    );
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    // KROK: Rozpoznanie zamówienia
    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            currentOrderID = code;
            playBeep(880, 100);
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                document.getElementById("btn-finish-order").style.display = "block";
                document.getElementById("order-title").innerText = "ZAMÓWIENIE ZNALEZIONE";
                updateStatus("Zamówienie: " + currentOrderID);
                fetchNextItem();
            });
        }
        return;
    }

    // KROK: Rozpoznanie produktu
    if (currentOrderID) {
        if (code === targetItem.ean) {
            isProcessing = true;
            playBeep(880, 100);
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                if (targetItem.pozostalo > 1) {
                    showQtyPanel();
                } else {
                    sendValidation(1);
                }
            });
        } else {
            updateStatus("BRAK PRODUKTU NA ZAMÓWIENIU!");
            playBeep(200, 500);
            flashUI("#ff453a");
        }
    }
}

function fetchNextItem() {
    updateStatus("Szukam następnej pozycji...");
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "next_item") {
                targetItem = res;
                displayTask(res);
            } else if (res.status === "order_finished") {
                alert("ZAMÓWIENIE ZREALIZOWANE W CAŁOŚCI");
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
                isProcessing = false;
                fetchNextItem();
            } else {
                updateStatus(res.msg); // "ZŁA ILOŚĆ WYDANIA!"
                playBeep(200, 600);
                flashUI("#ff453a");
                // Panel zostaje do poprawy
            }
        });
}

document.getElementById("btn-finish-order").onclick = () => {
    if (confirm("Zakończyć zamówienie? Postęp zostanie zapisany.")) {
        location.reload();
    }
};

function updateStatus(m) { document.getElementById("status-msg").innerText = m; }
function flashUI(c) { document.body.style.background = c; setTimeout(() => document.body.style.background = "#000", 1000); }
function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

initOrderScanner();
