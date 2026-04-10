const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwL9WvrgYCGl4q_Drdh32kp_6kajwAHWNO8jiB57uq2hLUO-DU2UyNklQ6b0GgHofDELg/exec"; 
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
const html5QrCode = new Html5Qrcode("reader");

function resetProductUI() {
    isProcessing = true;
    document.getElementById("task-panel").style.opacity = "0.3";
    document.getElementById("task-name").innerText = "Wczytywanie...";
    document.getElementById("task-kat").innerText = "---";
    document.getElementById("task-qty").innerText = "--";
    document.getElementById("task-lp").innerText = "--";
}

async function startQR() {
    isProcessing = false;
    document.body.classList.remove("ean-mode");
    document.body.classList.add("qr-mode");
    document.getElementById("scanner-instruction").style.display = "none";
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: 240 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.remove("qr-mode");
    document.body.classList.add("ean-mode");
    document.getElementById("target-kat-display").innerText = targetItem.nr_kat;
    document.getElementById("scanner-instruction").style.display = "block";
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: {width: 310, height: 120} }, onScan);
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    if (!currentOrderID) {
        isProcessing = true;
        setCornersColor("#32d74b");
        playBeep(880, 100);
        currentOrderID = code;
        document.getElementById("order-val").innerText = code;
        setTimeout(() => {
            html5QrCode.stop().then(() => {
                document.getElementById("scanner-box").style.display = "none";
                document.getElementById("btn-finish-icon").style.display = "flex";
                fetchNext(0);
            });
        }, 150);
    } else if (code === targetItem.ean) {
        isProcessing = true;
        setCornersColor("#32d74b");
        playBeep(880, 100);
        setTimeout(() => {
            html5QrCode.stop().then(() => {
                document.getElementById("scanner-box").style.display = "none";
                document.getElementById("scanner-instruction").style.display = "none";
                if (targetItem.pozostalo > 1) showQty();
                else sendVal(1);
            });
        }, 150);
    } else {
        showError("BŁĘDNY PRODUKT");
    }
}

async function fetchNext(offset) {
    resetProductUI();
    currentOffset = offset;
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            document.getElementById("task-lp").innerText = targetItem.lp;
            document.getElementById("task-name").innerText = targetItem.nazwa;
            document.getElementById("task-kat").innerText = targetItem.nr_kat;
            document.getElementById("task-qty").innerText = targetItem.pozostalo;
            document.getElementById("task-panel").style.opacity = "1";
            document.getElementById("task-panel").style.display = "block";
            isProcessing = false;
        } else {
            alert("ZREALIZOWANO");
            location.reload();
        }
    } catch (e) { isProcessing = false; }
}

function showQty() {
    const m = document.getElementById("qty-modal");
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    document.getElementById("qty-kat-val").innerText = "Nr Kat: " + targetItem.nr_kat;
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    m.style.display = "flex";
    const i = document.getElementById("qty-input");
    i.value = "";
    setTimeout(() => { i.focus(); i.click(); }, 100);
}

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json())
    .then(res => {
        if (res.status === "success") {
            document.getElementById("qty-modal").style.display = "none";
            fetchNext(currentOffset);
        } else {
            showError(res.msg);
        }
    });
}

function showError(m) {
    isProcessing = true;
    setCornersColor("#ff453a");
    playBeep(200, 600);
    const o = document.getElementById("error-overlay");
    document.getElementById("error-text").innerText = m;
    o.style.display = "flex";
    setTimeout(() => { o.style.display = "none"; isProcessing = false; setCornersColor("white"); }, 1500);
}

function setCornersColor(c) { 
    document.querySelectorAll('.corner').forEach(e => e.style.borderColor = c); 
}

document.getElementById("btn-qty-ok").onclick = () => sendVal(document.getElementById("qty-input").value);
document.getElementById("btn-scan-item").onclick = () => { 
    document.getElementById("task-panel").style.display = "none"; 
    document.getElementById("scanner-box").style.display = "block"; 
    startEAN(); 
};
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startQR();
