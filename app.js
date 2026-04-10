const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXB96VXPerbb_gXwETDOL6TOKgU_tEicY13vo3OsvjyWaWmDm32TPTh4KI13HsGZXeNg/exec";
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
            document.getElementById("order-title").innerText = "ZAMÓWIENIE: " + currentOrderID;
            setTimeout(() => {
                html5QrCode.stop().then(() => {
                    document.getElementById("camera-wrapper").style.display = "none";
                    document.getElementById("btn-finish").style.display = "block";
                    fetchNext();
                });
            }, 300);
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
            }, 300);
        } else {
            showError();
        }
    }
}

function fetchNext() {
    document.getElementById("task-card").style.display = "block";
    document.getElementById("task-nazwa-big").innerText = "SZUKANIE...";
    
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(r => r.json())
        .then(res => {
            isProcessing = false;
            if (res.status === "next_item") {
                targetItem = res;
                document.getElementById("task-nazwa-big").innerText = res.nazwa;
                document.getElementById("task-kat-val").innerText = "KATALOG: " + res.nr_kat;
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
    setTimeout(() => { input.focus(); input.select(); }, 150);
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
    setCornersColor("#ff453a");
    playBeep(200, 600);
    const overlay = document.getElementById("error-overlay");
    overlay.style.display = "flex";
    setTimeout(() => {
        overlay.style.display = "none";
        isProcessing = false;
        setCornersColor("white");
    }, 2000);
}

function setCornersColor(color) {
    document.querySelectorAll('.corner').forEach(c => c.style.borderColor = color);
}

document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    document.getElementById("camera-wrapper").style.display = "block";
    startEAN();
};

document.getElementById("btn-finish").onclick = () => { if(confirm("RESET?")) location.reload(); };

function playBeep(f, d) {
    try {
        const c = new AudioContext();
        const o = c.createOscillator();
        o.frequency.value = f; o.connect(c.destination);
        o.start(); o.stop(c.currentTime + (d/1000));
    } catch(e) {}
}

startQR();
