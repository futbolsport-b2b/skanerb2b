const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkhZWRqRuVNqGsUv-hZ0kqVfsnRgBbqEVUsTMfLADsGA0qjaxy6oRh9QzTCQ4nCZt9MA/exec";


let currentOrderID = null;
let lastScannedEAN = null;
const html5QrCode = new Html5Qrcode("reader");

async function startScanner(isEanMode = false) {
    if (html5QrCode.isScanning) { await html5QrCode.stop(); }

    const config = {
        fps: 20,
        qrbox: isEanMode ? { width: 320, height: 120 } : { width: 250, height: 250 },
        aspectRatio: isEanMode ? 2.5 : 1.0
    };

    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

function onScanSuccess(decodedText) {
    const code = decodedText.trim();

    // 1. SKAN QR ZAMÓWIENIA
    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        currentOrderID = code;
        document.body.classList.add("ean-active");
        document.getElementById("order-id-display").innerText = currentOrderID;
        updateStatus("Zalogowano. Skanuj produkty...");
        playBeep(880, 150);
        startScanner(true);
        return;
    }

    // 2. SKAN EAN PRODUKTU
    if (currentOrderID && code !== currentOrderID) {
        html5QrCode.pause(true); // Wstrzymanie z zachowaniem obrazu
        lastScannedEAN = code;
        
        document.getElementById("scanned-product-name").innerText = "OSTATNI EAN: " + code;
        document.getElementById("qty-section").style.display = "flex";
        document.getElementById("quantity-input").value = 1;
        document.getElementById("quantity-input").focus();
        
        updateStatus("Wprowadź ilość dla: " + code);
        playBeep(600, 100);
    }
}

function updateStatus(msg) {
    document.getElementById("status-msg").innerText = msg;
}

function resumeScanning() {
    document.getElementById("qty-section").style.display = "none";
    updateStatus("Skanuj kolejny produkt...");
    html5QrCode.resume();
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    updateStatus("Przesyłanie: " + qty + " szt...");
    document.getElementById("qty-section").style.display = "none";

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            updateStatus(result.msg);
            if (result.status === "success") {
                playBeep(880, 200);
                flashUI("#30d158");
            } else {
                playBeep(200, 500);
                flashUI("#ff453a");
            }
            // Powrót do skanowania po 1.5 sekundy od otrzymania odpowiedzi
            setTimeout(resumeScanning, 1500);
        })
        .catch(() => {
            updateStatus("Błąd połączenia!");
            setTimeout(resumeScanning, 2000);
        });
};

document.getElementById("btn-cancel-qty").onclick = resumeScanning;

function flashUI(color) {
    const msg = document.getElementById("status-msg");
    const original = "#1c1c1e";
    msg.style.background = color;
    setTimeout(() => msg.style.background = original, 1000);
}

function playBeep(f, d) {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) { console.log("Audio block"); }
}

startScanner(false);
