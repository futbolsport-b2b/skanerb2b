const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkhZWRqRuVNqGsUv-hZ0kqVfsnRgBbqEVUsTMfLADsGA0qjaxy6oRh9QzTCQ4nCZt9MA/exec";

let currentOrderID = null;
let lastScannedEAN = null;
const html5QrCode = new Html5Qrcode("reader");

// Funkcja startująca skaner z parametrami
async function startScanner(isEanMode = false) {
    if (html5QrCode.isScanning) {
        await html5QrCode.stop();
    }

    const config = {
        fps: 20,
        qrbox: isEanMode ? { width: 300, height: 100 } : { width: 250, height: 250 },
        aspectRatio: isEanMode ? 3.0 : 1.0
    };

    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

function onScanSuccess(decodedText) {
    const code = decodedText.trim();

    // 1. WYKRYCIE ZAMÓWIENIA (QR)
    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        currentOrderID = code;
        document.body.classList.add("ean-active");
        document.getElementById("order-id-display").innerText = currentOrderID;
        document.getElementById("status-msg").innerText = "Zalogowano. Skanuj produkty.";
        
        playBeep(880, 150);
        // Restart skanera w trybie EAN (wąskie pole)
        startScanner(true);
        return;
    }

    // 2. WYKRYCIE PRODUKTU (EAN)
    if (currentOrderID && code !== currentOrderID) {
        html5QrCode.pause();
        lastScannedEAN = code;
        
        document.getElementById("scanned-product-name").innerText = "EAN: " + code;
        document.getElementById("qty-section").style.display = "flex";
        document.getElementById("quantity-input").value = 1;
        document.getElementById("quantity-input").focus();
        
        playBeep(600, 100);
    }
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    document.getElementById("qty-section").style.display = "none";
    document.getElementById("status-msg").innerText = "Przesyłanie danych...";

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            document.getElementById("status-msg").innerText = result.msg;
            if (result.status === "success") {
                playBeep(880, 200);
                flashUI("#30d158");
            } else {
                playBeep(200, 500);
                flashUI("#ff453a");
            }
            setTimeout(() => html5QrCode.resume(), 1500);
        });
};

function flashUI(color) {
    const msg = document.getElementById("status-msg");
    const original = msg.style.background;
    msg.style.background = color;
    setTimeout(() => msg.style.background = original, 1000);
}

function playBeep(f, d) {
    const c = new AudioContext();
    const o = c.createOscillator();
    o.frequency.value = f; o.connect(c.destination);
    o.start(); o.stop(c.currentTime + (d/1000));
}

// Pierwsze uruchomienie
startScanner(false);
