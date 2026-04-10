const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwONKu6dvOoVauY7AIkG6N39WfrfXb0Wfd0UiqDiPjWkxaWfIIAqCLrE64gZtZ4yjkaZA/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: 260 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.add("ean-mode");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: {width: 300, height: 120} }, onScan);
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            isProcessing = true;
            playBeep(880, 100);
            currentOrderID = code;
            document.getElementById("order-title").innerText = "ZAMÓWIENIE ZNALEZIONE: " + currentOrderID;
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                document.getElementById("btn-finish").style.display = "block";
                fetchNext();
            });
        }
    } else {
        if (code === targetItem.ean) {
            isProcessing = true;
            playBeep(880, 100);
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                if (targetItem.pozostalo > 1) {
                    showQty();
                } else {
                    sendVal(1);
                }
            });
        } else {
            showError();
        }
    }
}

function fetchNext() {
    document.getElementById("task-card").style.display = "block";
    document.getElementById("task-nazwa").innerText = "Pobieranie zadania...";
    
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(r => r.json())
        .then(res => {
            isProcessing = false;
            if (res.status === "next_item") {
                targetItem = res;
                document.getElementById("task-lp-val").innerText = res.lp;
                document.getElementById("task-nazwa").innerText = res.nazwa;
                document.getElementById("task-kat").innerText = "KAT: " + res.nr_kat;
                document.getElementById("task-qty-val").innerText = res.pozostalo;
            } else {
                alert(res.msg);
                location.reload();
            }
        });
}

function showQty() {
    document.getElementById("qty-panel").style.display = "block";
    const input = document.getElementById("qty-input");
    input.value = 1;
    // Naprawa klawiatury na iOS/Android
    setTimeout(() => { 
        input.focus(); 
        input.click(); 
        input.setSelectionRange(0, 9999); 
    }, 100);
}

document.getElementById("btn-qty-ok").onclick = () => {
    sendVal(document.getElementById("qty-input").value);
};

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
        .then(r => r.json())
        .then(res => {
            if (res.status === "success") {
                document.getElementById("qty-panel").style.display = "none";
                fetchNext();
            } else {
                alert(res.msg);
                isProcessing = false;
            }
        });
}

function showError() {
    isProcessing = true;
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
    }, 2000);
}

document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    document.getElementById("camera-wrapper").style.display = "block";
    startEAN();
};

document.getElementById("btn-finish").onclick = () => { if(confirm("Zakończyć?")) location.reload(); };

function playBeep(f, d) {
    try {
        const c = new AudioContext();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) {}
}

startQR();
