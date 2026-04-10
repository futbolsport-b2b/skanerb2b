const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZjG2ARNuillDNiBrwL3tBCVCMf3cIcPSkF93m5dbyHKJwgzYAxIDKgDrnoD3OzNw7Lw/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

// Cache-friendly fetch
async function fastFetch(params) {
    const url = `${SCRIPT_URL}?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    return await response.json();
}

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.add("ean-mode");
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            isProcessing = true;
            setCornersColor("#30d158");
            playBeep(880, 100);
            currentOrderID = code;
            document.getElementById("order-title").innerText = "ZAMÓWIENIE: " + currentOrderID;
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    document.getElementById("btn-finish-icon").style.display = "flex";
                    fetchNext();
                });
            }, 150); // Skrócony timeout
        }
    } else {
        if (code === targetItem.ean) {
            isProcessing = true;
            setCornersColor("#30d158");
            playBeep(880, 100);
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    if (targetItem.pozostalo > 1) {
                        showQty();
                    } else {
                        sendVal(1);
                    }
                });
            }, 150);
        } else {
            showError();
        }
    }
}

async function fetchNext() {
    const card = document.getElementById("task-card");
    const title = document.getElementById("task-nazwa-big");
    card.style.display = "block";
    title.innerText = "Wczytywanie...";
    
    try {
        const res = await fastFetch({ orderID: currentOrderID, action: "get_next" });
        isProcessing = false;
        if (res.status === "next_item") {
            targetItem = res;
            title.innerText = res.nazwa;
            document.getElementById("task-kat-val").innerText = "KATALOG: " + res.nr_kat;
            document.getElementById("task-qty-val").innerText = res.pozostalo;
        } else {
            location.reload();
        }
    } catch (e) { isProcessing = false; }
}

function showQty() {
    const panel = document.getElementById("qty-panel");
    panel.style.display = "block";
    const input = document.getElementById("qty-input");
    input.value = 1;
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

document.getElementById("btn-qty-ok").onclick = function() {
    // UI Prediction: ukrywamy panel od razu
    document.getElementById("qty-panel").style.display = "none";
    sendVal(document.getElementById("qty-input").value);
};

async function sendVal(q) {
    try {
        const res = await fastFetch({ 
            orderID: currentOrderID, 
            ean: targetItem.ean, 
            qty: q, 
            action: "validate" 
        });
        if (res.status === "success") {
            fetchNext();
        } else {
            alert(res.msg);
            isProcessing = false;
            showQty(); // Przywróć przy błędzie
        }
    } catch (e) { isProcessing = false; }
}

function showError() {
    isProcessing = true;
    setCornersColor("#ff453a");
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
        setCornersColor("white");
    }, 1500); // Krótszy błąd
}

function setCornersColor(color) {
    document.querySelectorAll('.corner').forEach(c => c.style.borderColor = color);
}

document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    document.getElementById("camera-wrapper").style.display = "block";
    startEAN();
};

document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };

function playBeep(f, d) {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) {}
}

startQR();
