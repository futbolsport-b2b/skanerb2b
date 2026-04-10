const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkhZWRqRuVNqGsUv-hZ0kqVfsnRgBbqEVUsTMfLADsGA0qjaxy6oRh9QzTCQ4nCZt9MA/exec";

let currentOrderID = null;
let lastScannedEAN = null;
const statusDisplay = document.getElementById('status-display');
const orderBadge = document.getElementById('order-badge');
const debugLog = document.getElementById('debug-log');
const btnFinish = document.getElementById('btn-finish');
const qtySection = document.getElementById('qty-section');
const qtyInput = document.getElementById('quantity-input');

const html5QrCode = new Html5Qrcode("reader");

// Start systemu
html5QrCode.start(
    { facingMode: "environment" }, 
    { fps: 15, qrbox: { width: 200, height: 200 } }, 
    onScanSuccess
);

function onScanSuccess(decodedText) {
    const code = decodedText.trim();

    // 1. ZAMÓWIENIE (QR)
    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        currentOrderID = code;
        orderBadge.innerText = "SESJA: " + currentOrderID;
        orderBadge.className = "badge-active";
        btnFinish.style.display = "block";
        statusDisplay.value = "GOTOWY DO SKANOWANIA EAN";
        
        // Przełączenie celownika na linię
        document.getElementById('reader').classList.add("ean-mode");
        playBeep(880, 100);
        return;
    }

    // 2. PRODUKT (EAN) - Pokazanie pól pod skanerem
    if (currentOrderID && code !== currentOrderID) {
        html5QrCode.pause();
        lastScannedEAN = code;
        
        statusDisplay.value = "PRODUKT: " + code;
        qtySection.style.display = "block"; // Pokaż sekcję ilości zamiast modala
        qtyInput.value = 1;
        qtyInput.select();
        playBeep(600, 100);
    }
}

document.getElementById('btn-confirm-qty').addEventListener('click', () => {
    const qty = qtyInput.value;
    qtySection.style.display = "none";
    statusDisplay.value = "WYSYŁANIE...";

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            statusDisplay.value = result.msg;
            if (result.status === "success") {
                document.body.style.background = "#064e3b";
                playBeep(880, 200);
            } else {
                document.body.style.background = "#7f1d1d";
                playBeep(200, 500);
            }
            setTimeout(() => {
                document.body.style.background = "#0f172a";
                html5QrCode.resume();
            }, 1500);
        });
});

btnFinish.addEventListener('click', () => {
    location.reload(); // Najczystszy sposób na reset całego interfejsu
});

function playBeep(f, d) {
    const c = new AudioContext();
    const o = c.createOscillator();
    o.frequency.value = f; o.connect(c.destination);
    o.start(); o.stop(c.currentTime + (d/1000));
}
