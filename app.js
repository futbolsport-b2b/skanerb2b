const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOCIJplV0NlgnL5VL3XfZDtIFZ8Y4oyMUepvCScFKbmqTB1q08_AhROKIpDkxnF8UfcA/exec";

const statusDisplay = document.getElementById('status-display');
const btnAction = document.getElementById('btn-action');
const orderBadge = document.getElementById('order-badge');
const debugLog = document.getElementById('debug-log');

let currentOrderID = null;
let isScanning = false;

btnAction.addEventListener('click', () => {
    if (!isScanning) {
        startScanner();
    } else {
        stopScanner();
    }
});

function startScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: { facingMode: "environment" }
        },
        decoder: { readers: ["ean_reader", "code_128_reader"] },
        locate: true
    }, function(err) {
        if (err) { debugLog.innerText = err; return; }
        Quagga.start();
        isScanning = true;
        btnAction.innerText = "ZATRZYMAJ SKANER";
        debugLog.innerText = "Skaner gotowy...";
    });
}

function stopScanner() {
    Quagga.stop();
    isScanning = false;
    btnAction.innerText = "URUCHOM APARAT";
}

Quagga.onDetected((data) => {
    const code = data.codeResult.code;
    Quagga.stop(); // Pauza na czas zapytania do Google

    // KROK 1: Logowanie zamówienia
    if (!currentOrderID) {
        currentOrderID = code;
        orderBadge.innerText = "ZAMÓWIENIE: " + currentOrderID;
        orderBadge.style.background = "#007bff";
        statusDisplay.value = "ZALOGOWANO. SKANUJ PRODUKTY";
        playBeep(880, 100);
        setTimeout(() => Quagga.start(), 1000);
        return;
    }

    // KROK 2: Walidacja produktu w Google Sheets
    statusDisplay.value = "SPRAWDZANIE...";
    
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(code)}`)
        .then(res => res.json())
        .then(result => {
            if (result.status === "success") {
                flashUI("#28a745"); // Zielony
                statusDisplay.value = result.msg;
                playBeep(880, 200);
            } else if (result.status === "error" || result.status === "not_found") {
                flashUI("#dc3545"); // Czerwony
                statusDisplay.value = result.msg;
                playBeep(200, 500);
                if (navigator.vibrate) navigator.vibrate(500);
            }
            
            setTimeout(() => {
                if (isScanning) Quagga.start();
            }, 1500);
        })
        .catch(err => {
            debugLog.innerText = "Błąd sieci: " + err;
            Quagga.start();
        });
});

function flashUI(color) {
    document.body.style.backgroundColor = color;
    setTimeout(() => {
        document.body.style.backgroundColor = "#121212";
    }, 1000);
}

function playBeep(freq, duration) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, context.currentTime);
    osc.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + (duration/1000));
}
