const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwn096nSEfnykeCIkZfiK7BBkEOvUpiRG1tQkgew7qVL_efFbu_gpQakNfDTRzUMqEEeg/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

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
            document.getElementById("order-number-val").innerText = currentOrderID;
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    document.getElementById("btn-finish-icon").style.display = "flex";
                    fetchNext();
                });
            }, 100);
        }
    } else {
        if (code === targetItem.ean) {
            isProcessing = true;
            setCornersColor("#30d158");
            playBeep(880, 100);
            
            // KLUCZOWE: Otwieramy panel ZANIM zatrzymamy skaner, by focus zadziałał
            if (targetItem.pozostalo > 1) {
                showQty();
            }

            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    if (targetItem.pozostalo <= 1) sendVal(1);
                });
            }, 100);
        } else {
            showError("BŁĘDNY PRODUKT");
        }
    }
}

async function fetchNext() {
    document.getElementById("task-card").style.display = "block";
    document.getElementById("task-nazwa-big").innerText = "Wczytywanie...";
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&action=get_next`).then(r => r.json());
        isProcessing = false;
        if (res.status === "next_item") {
            targetItem = res;
            document.getElementById("task-nazwa-big").innerText = res.nazwa;
            document.getElementById("task-kat-val").innerText = "KATALOG: " + res.nr_kat;
            document.getElementById("task-qty-val").innerText = res.pozostalo;
        } else {
            location.reload();
        }
    } catch (e) { isProcessing = false; }
}

function showQty() {
    const panel = document.getElementById("qty-panel");
    const input = document.getElementById("qty-input");
    const btn = document.getElementById("btn-qty-ok");
    
    btn.classList.remove("clicked");
    panel.style.display = "block";
    input.value = "";
    
    // Focus musi być wywołany natychmiast
    input.focus();
    input.click();
}

document.getElementById("btn-qty-ok").onclick = function() {
    const val = document.getElementById("qty-input").value;
    if(!val || val <= 0) return;
    
    // Animacja przycisku
    this.classList.add("clicked");
    
    setTimeout(() => {
        document.getElementById("qty-panel").style.display = "none";
        sendVal(val);
    }, 150);
};

async function sendVal(q) {
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${currentOrderID}&ean=${targetItem.ean}&qty=${q}&action=validate`).then(r => r.json());
        if (res.status === "success") {
            fetchNext();
        } else {
            showError(res.msg); // Pokazuje "ZŁA ILOŚĆ WYDANIA" bez alertu
            isProcessing = false;
            setTimeout(showQty, 1500); // Wraca do wpisywania po pokazaniu błędu
        }
    } catch (e) { isProcessing = false; }
}

function showError(msg) {
    isProcessing = true;
    setCornersColor("#ff453a");
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.innerText = msg;
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
        setCornersColor("white");
    }, 1500);
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
