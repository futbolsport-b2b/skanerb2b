const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgdcUKm7howF96-S-jUCqAxHVDlGI2nl21hEENlu63hpr8C66X7qe0NId26vGiUPcbJQ/exec";

let currentOrderID = null;
let lastScannedEAN = null;
const statusDisplay = document.getElementById('status-display');
const orderBadge = document.getElementById('order-badge');
const debugLog = document.getElementById('debug-log');
const btnFinish = document.getElementById('btn-finish');
const modal = document.getElementById('quantity-modal');
const qtyInput = document.getElementById('quantity-input');

const html5QrCode = new Html5Qrcode("reader");

// Inicjalizacja skanera
html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess);

function onScanSuccess(decodedText) {
    const code = decodedText.trim();

    // KROK 1: LOGOWANIE ZAMÓWIENIA
    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            currentOrderID = code;
            orderBadge.innerText = "ZAM: " + currentOrderID;
            orderBadge.className = "badge-active";
            btnFinish.style.display = "block";
            statusDisplay.value = "ZALOGOWANO. SKANUJ EAN";
            document.getElementById('reader').classList.add("ean-mode");
            playBeep(880, 100);
        }
        return;
    }

    // KROK 2: SKANOWANIE PRODUKTU - OTWARCIE OKNA ILOŚCI
    if (currentOrderID && code !== currentOrderID) {
        html5QrCode.pause();
        lastScannedEAN = code;
        qtyInput.value = 1; // domyślnie 1
        modal.style.display = "flex";
        qtyInput.focus();
    }
}

// Obsługa przycisku ZATWIERDŹ ILOŚĆ
document.getElementById('btn-confirm-qty').addEventListener('click', () => {
    const qty = qtyInput.value;
    modal.style.display = "none";
    statusDisplay.value = "PRZESYŁANIE: " + qty + " szt...";

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            statusDisplay.value = result.msg;
            if (result.status === "success") {
                flashUI("#28a745");
                playBeep(880, 200);
            } else {
                flashUI("#dc3545");
                playBeep(200, 500);
            }
            setTimeout(() => html5QrCode.resume(), 1500);
        });
});

// Obsługa przycisku ZAKOŃCZ
btnFinish.addEventListener('click', () => {
    if(confirm("Czy zakończyć obsługę zamówienia " + currentOrderID + "?")) {
        currentOrderID = null;
        orderBadge.innerText = "BRAK ZAMÓWIENIA";
        orderBadge.className = "badge-waiting";
        btnFinish.style.display = "none";
        statusDisplay.value = "ZESKANUJ QR ZAMÓWIENIA";
        document.getElementById('reader').classList.remove("ean-mode");
        html5QrCode.resume();
    }
});

document.getElementById('btn-cancel-qty').addEventListener('click', () => {
    modal.style.display = "none";
    html5QrCode.resume();
});

function flashUI(color) {
    document.body.style.backgroundColor = color;
    setTimeout(() => document.body.style.backgroundColor = "#121212", 1000);
}

function playBeep(f, d) {
    const c = new AudioContext();
    const o = c.createOscillator();
    o.frequency.value = f; o.connect(c.destination);
    o.start(); o.stop(c.currentTime + (d/1000));
}
