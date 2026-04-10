const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkhZWRqRuVNqGsUv-hZ0kqVfsnRgBbqEVUsTMfLADsGA0qjaxy6oRh9QzTCQ4nCZt9MA/exec";


let currentOrderID = null;
let lastScannedEAN = null;
let isProcessing = false; // Nowa flaga zamiast pause()

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

/* ... stałe bez zmian ... */

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    // 1. SKAN QR ZAMÓWIENIA
    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        isProcessing = true;
        currentOrderID = code;
        document.body.classList.add("ean-active");
        document.getElementById("order-id-display").innerText = currentOrderID;
        updateStatus("Zalogowano. Skanuj towar.");
        playBeep(880, 100);
        
        setTimeout(() => {
            isProcessing = false;
            startScanner(true);
        }, 800);
        return;
    }

    // 2. SKAN EAN PRODUKTU
    if (currentOrderID && code !== currentOrderID) {
        isProcessing = true;
        lastScannedEAN = code;
        
        document.getElementById("scanned-product-name").innerText = "PRODUKT: " + code;
        
        // Zamiast flex, używamy block dla lepszej stabilności
        const qtySection = document.getElementById("qty-section");
        qtySection.style.display = "block"; 
        
        const input = document.getElementById("quantity-input");
        input.value = 1;
        
        // Przewijamy panel do widoku, gdyby klawiatura go zasłoniła
        setTimeout(() => input.focus(), 100);
        
        updateStatus("Podaj ilość");
        playBeep(600, 100);
    }
}

/* ... reszta funkcji bez zmian ... */
function updateStatus(msg) {
    document.getElementById("status-msg").innerText = msg;
}

// Funkcja przywracająca gotowość do skanowania
function resetScannerState() {
    isProcessing = false;
    document.getElementById("qty-section").style.display = "none";
    updateStatus("Skanuj kolejny produkt...");
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    updateStatus("Wysyłanie...");
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
            // Odczekaj chwilę, by użytkownik widział wynik, potem odblokuj skanowanie
            setTimeout(resetScannerState, 1500);
        })
        .catch(() => {
            updateStatus("Błąd połączenia!");
            setTimeout(resetScannerState, 2000);
        });
};

document.getElementById("btn-cancel-qty").onclick = resetScannerState;

function flashUI(color) {
    const msg = document.getElementById("status-msg");
    msg.style.background = color;
    setTimeout(() => msg.style.background = "#1c1c1e", 1000);
}

function playBeep(f, d) {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) {}
}

startScanner(false);
