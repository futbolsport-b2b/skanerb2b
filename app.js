const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxVQ0fYN50I6JYtHJDBPks3GFv3B5JYMNJHr4k4JpHv5VNHj6UWh8tj2F4Q2xMn10whlw/exec";
let currentOrderID = null;
let lastScannedEAN = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

async function startScanner(isEanMode = false) {
    if (html5QrCode.isScanning) { await html5QrCode.stop(); }
    const config = {
        fps: 25,
        qrbox: isEanMode ? { width: 300, height: 100 } : { width: 220, height: 220 },
        aspectRatio: isEanMode ? 3.0 : 1.0
    };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    if (!currentOrderID && (code.includes("/") || code.includes("DHH"))) {
        isProcessing = true;
        currentOrderID = code;
        document.body.classList.add("ean-active");
        document.getElementById("order-id-display").innerText = currentOrderID;
        playBeep(880, 100);
        setTimeout(() => { isProcessing = false; startScanner(true); }, 500);
        return;
    }

    if (currentOrderID && code !== currentOrderID) {
        isProcessing = true;
        lastScannedEAN = code;
        playBeep(600, 100);
        
        fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(code)}&qty=0`)
            .then(res => res.json())
            .then(res => {
                if (res.status === "info" || res.status === "success") {
                    document.getElementById("scanned-product-name").innerText = res.nazwa;
                    document.getElementById("status-msg").innerText = "Brakuje: " + res.pozostalo + " szt.";
                    document.getElementById("qty-section").style.display = "block";
                    const input = document.getElementById("quantity-input");
                    input.value = 1;
                    setTimeout(() => { input.focus(); input.select(); }, 200);
                } else {
                    document.getElementById("status-msg").innerText = res.msg;
                    flashUI("#ff453a");
                    isProcessing = false;
                }
            })
            .catch(() => { isProcessing = false; });
    }
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    document.getElementById("btn-confirm-qty").disabled = true;

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(lastScannedEAN)}&qty=${qty}`)
        .then(res => res.json())
        .then(result => {
            document.getElementById("btn-confirm-qty").disabled = false;
            document.getElementById("status-msg").innerText = result.msg;

            if (result.status === "success") {
                playBeep(880, 200);
                flashUI("#30d158");
                document.getElementById("qty-section").style.display = "none";
                isProcessing = false;
            } else {
                playBeep(200, 600);
                flashUI("#ff453a");
                document.getElementById("quantity-input").focus();
            }
        });
};

document.getElementById("btn-cancel-qty").onclick = () => {
    document.getElementById("qty-section").style.display = "none";
    isProcessing = false;
    document.getElementById("status-msg").innerText = "Skanuj kolejny...";
};

function flashUI(color) {
    const msg = document.getElementById("status-msg");
    const original = "#1c1c1e";
    msg.style.background = color;
    setTimeout(() => msg.style.background = original, 1000);
}

function playBeep(f, d) {
    try {
        const c = new AudioContext();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) {}
}

startScanner(false);
