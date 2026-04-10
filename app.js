const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxvYEHsQp45ooAQVmyUD36J7CEkwP_4VrxuUSHzD-8dcNFri6V2P7EzrssuZNfo5VWhg/exec";

let currentOrderID = null;
let lastScannedEAN = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

async function startScanner(isEanMode = false) {
    if (html5QrCode.isScanning) { await html5QrCode.stop(); }
    
    // Konfiguracja pod iPhone 17 Pro - różne wymiary dla QR i EAN
    const config = {
        fps: 25,
        qrbox: isEanMode ? { width: 320, height: 120 } : { width: 250, height: 250 },
        aspectRatio: isEanMode ? 2.66 : 1.0
    };

    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    // 1. SKAN QR ZAMÓWIENIA
    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        isProcessing = true;
        currentOrderID = code;
        document.body.classList.add("ean-active");
        document.getElementById("order-id-display").innerText = currentOrderID;
        updateStatus("ZALOGOWANO. SKANUJ PRODUKTY.");
        playBeep(880, 150);
        
        // Zmniejszamy aparat i restartujemy skaner w trybie liniowym
        setTimeout(() => {
            isProcessing = false;
            startScanner(true);
        }, 600);
        return;
    }

    // 2. SKAN EAN PRODUKTU
    if (currentOrderID && code !== currentOrderID) {
        isProcessing = true;
        lastScannedEAN = code;
        
        document.getElementById("scanned-product-name").innerText = "PRODUKT: " + code;
        document.getElementById("qty-section").style.display = "block";
        
        const qtyInput = document.getElementById("quantity-input");
        qtyInput.value = 1;
        updateStatus("Wprowadź ilość");
        playBeep(600, 100);
        
        // Automatyczne zaznaczenie pola ilości
        setTimeout(() => {
            qtyInput.focus();
            qtyInput.select();
        }, 100);
    }
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    const btn = document.getElementById("btn-confirm-qty");
    
    updateStatus("Weryfikacja w bazie...");
    btn.disabled = true;

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            updateStatus(result.msg);
            btn.disabled = false;

            if (result.status === "success") {
                // SUKCES - Czyścimy i wracamy do skanowania
                playBeep(880, 200);
                flashUI("#30d158");
                setTimeout(resetScannerUI, 1200);
            } else {
                // BŁĄD - Okno zostaje, by pracownik poprawił ilość
                playBeep(200, 600);
                flashUI("#ff453a");
                document.getElementById("quantity-input").focus();
            }
        })
        .catch(() => {
            updateStatus("BŁĄD POŁĄCZENIA!");
            btn.disabled = false;
        });
};

document.getElementById("btn-cancel-qty").onclick = resetScannerUI;

function resetScannerUI() {
    isProcessing = false;
    document.getElementById("qty-section").style.display = "none";
    updateStatus("Skanuj kolejny produkt...");
}

function updateStatus(msg) {
    document.getElementById("status-msg").innerText = msg;
}

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
    } catch(e) {}
}

// Start w trybie QR
startScanner(false);
