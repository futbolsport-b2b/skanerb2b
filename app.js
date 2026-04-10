const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgdcUKm7howF96-S-jUCqAxHVDlGI2nl21hEENlu63hpr8C66X7qe0NId26vGiUPcbJQ/exec";

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
    const code = decodedText.trim();

    // 1. LOGOWANIE ZAMÓWIENIA (Jeśli skan zawiera ukośniki lub "DHH")
    if (code.includes("/") || code.includes("DHH")) {
        currentOrderID = code;
        orderBadge.innerText = "ZAM: " + currentOrderID;
        orderBadge.className = "badge-active";
        statusDisplay.value = "ZALOGOWANO ZAMÓWIENIE";
        playBeep(880, 100);
        
        // Czyścimy tło i wracamy do skanowania produktów
        setTimeout(() => {
            statusDisplay.value = "SKANUJ PRODUKTY (EAN)";
            html5QrCode.resume();
        }, 1000);
        return;
    }

    // 2. WALIDACJA PRODUKTU (Jeśli już mamy zamówienie i skanujemy coś innego)
    if (currentOrderID) {
        html5QrCode.pause();
        statusDisplay.value = "SPRAWDZANIE EAN: " + code;

        fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(code)}`)
            .then(res => res.json())
            .then(result => {
                if (result.status === "success") {
                    flashUI("#28a745"); // Zielony
                } else {
                    flashUI("#dc3545"); // Czerwony
                    if (navigator.vibrate) navigator.vibrate(500);
                }
                statusDisplay.value = result.msg;
                playBeep(result.status === "success" ? 880 : 200, 300);
                
                setTimeout(() => html5QrCode.resume(), 1500);
            })
            .catch(err => {
                statusDisplay.value = "BŁĄD POŁĄCZENIA";
                html5QrCode.resume();
            });
    } else {
        statusDisplay.value = "NAJPIERW ZESKANUJ QR ZAMÓWIENIA!";
        playBeep(200, 500);
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
