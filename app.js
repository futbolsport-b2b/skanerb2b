const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOCIJplV0NlgnL5VL3XfZDtIFZ8Y4oyMUepvCScFKbmqTB1q08_AhROKIpDkxnF8UfcA/exec";

let currentOrderID = null;
const statusDisplay = document.getElementById('status-display');
const orderBadge = document.getElementById('order-badge');
const debugLog = document.getElementById('debug-log');

// Konfiguracja skanera
const html5QrCode = new Html5Qrcode("reader");
const config = { fps: 10, qrbox: { width: 250, height: 250 } };

const startSkanowanie = () => {
    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess
    );
};

function onScanSuccess(decodedText, decodedResult) {
    // 1. Jeśli nie mamy zamówienia, szukamy kodu QR (SB2B/...)
    if (!currentOrderID) {
        if (decodedText.includes("SB2B") || decodedText.includes("/")) {
            currentOrderID = decodedText;
            orderBadge.innerText = "ZAM: " + currentOrderID;
            orderBadge.className = "badge-active";
            statusDisplay.value = "ZALOGOWANO. SKANUJ EAN13";
            playBeep(880, 100);
            debugLog.innerText = "Teraz skanuj produkty (EAN13)";
        } else {
            statusDisplay.value = "TO NIE JEST KOD ZAMÓWIENIA!";
        }
        return;
    }

    // 2. Jeśli mamy zamówienie, skanujemy EAN13
    if (currentOrderID) {
        // Blokujemy skaner na czas wysyłki
        html5QrCode.pause();
        statusDisplay.value = "SPRAWDZANIE: " + decodedText;

        fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(decodedText)}`)
            .then(res => res.json())
            .then(result => {
                if (result.status === "success") {
                    flashUI("#28a745");
                    statusDisplay.value = result.msg;
                    playBeep(880, 200);
                } else {
                    flashUI("#dc3545");
                    statusDisplay.value = result.msg;
                    playBeep(200, 500);
                    if (navigator.vibrate) navigator.vibrate(500);
                }
                setTimeout(() => html5QrCode.resume(), 2000);
            })
            .catch(err => {
                debugLog.innerText = "Błąd połączenia z Arkuszem";
                html5QrCode.resume();
            });
    }
}

function flashUI(color) {
    document.body.style.backgroundColor = color;
    setTimeout(() => document.body.style.backgroundColor = "#121212", 1000);
}

function playBeep(freq, duration) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    osc.frequency.setValueAtTime(freq, context.currentTime);
    osc.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + (duration/1000));
}

// Uruchomienie na starcie
startSkanowanie();
