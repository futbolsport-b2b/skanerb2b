const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztwhvZkWkLVSt4yfpalrAT7JYTqnSimlE3tRUH3GH3E7i3qIRUyX64T2gCMi1JWDSV/exec"; 
const IMAGE_BASE_URL = "https://b2b.futbolsport.pl/gfx-base/s_1/gfx/products/big/";
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
let currentInputValue = "0"; 
const html5QrCode = new Html5Qrcode("reader");

// SYSTEM DEBUGOWANIA (v43.9)
function logCameraError(msg) {
    const dbg = document.getElementById("camera-debug-info");
    dbg.style.display = "block";
    dbg.innerHTML += `<div>> ${msg}</div>`;
}

// WYMUSZENIE HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    alert("Kamera wymaga połączenia HTTPS! Zmień adres na https://...");
}

async function startScanner(mode) {
    isProcessing = false;
    const config = { fps: 25, qrbox: mode === 'qr' ? 250 : { width: 300, height: 150 } };
    
    try {
        await html5QrCode.start({ facingMode: "environment" }, config, onScan);
        document.getElementById("camera-debug-info").style.display = "none";
    } catch (err) {
        logCameraError(`BŁĄD: ${err}`);
        if (err.name === "NotAllowedError") {
            logCameraError("PRZEGLĄDARKA BLOKUJE APARAT. Kliknij ikonę kłódki przy pasku adresu i zezwól na kamerę.");
        }
    }
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();
    if (!currentOrderID) {
        isProcessing = true;
        currentOrderID = code;
        document.getElementById("order-val").innerText = code;
        document.getElementById("order-val").classList.remove("breathing");
        html5QrCode.stop().then(() => {
            document.getElementById("scanner-box").style.display = "none";
            document.getElementById("btn-finish-icon").style.display = "flex";
            fetchNext(0);
        });
    } else if (code === targetItem.ean) {
        isProcessing = true;
        html5QrCode.stop().then(() => {
            document.getElementById("scanner-box").style.display = "none";
            if (targetItem.pozostalo > 1) showQty(); else sendVal(1);
        });
    }
}

async function fetchNext(offset) {
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if (res.status === "next_item") {
            targetItem = res.item; currentOffset = res.current_offset;
            document.getElementById("task-lp").innerText = targetItem.lp;
            document.getElementById("task-name").innerText = targetItem.nazwa;
            document.getElementById("task-kat").innerText = targetItem.nr_kat;
            document.getElementById("task-qty").innerText = targetItem.pozostalo;
            document.getElementById("task-size").innerText = targetItem.rozmiar || "---";
            
            const imgElem = document.getElementById("task-img");
            const katFormatted = String(targetItem.nr_kat).replace(/\s+/g, '_');
            imgElem.src = `${IMAGE_BASE_URL}1_${katFormatted}.jpg`;
            imgElem.onload = () => document.getElementById("product-image-box").style.display = "flex";
            imgElem.onerror = () => document.getElementById("product-image-box").style.display = "none";

            document.getElementById("task-panel").style.display = "block";
            if(res.progress) document.getElementById("global-progress-fill").style.width = res.progress + "%";
        } else { alert("ZAKOŃCZONO"); location.reload(); }
    } catch (e) { console.error(e); }
}

function showQty() {
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    document.getElementById("qty-kat-val").innerText = "Nr Kat: " + targetItem.nr_kat;
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    updateDisplay("0");
    document.getElementById("qty-modal").style.display = "flex";
}

function updateDisplay(v) { currentInputValue = v; document.getElementById("qty-input-display").innerText = v; }

document.querySelectorAll('.np-btn[data-val]').forEach(b => {
    b.onclick = () => {
        let v = b.dataset.val;
        let next = currentInputValue === "0" ? v : currentInputValue + v;
        if (parseInt(next) <= targetItem.pozostalo) updateDisplay(next);
    }
});
document.getElementById('np-del').onclick = () => updateDisplay(currentInputValue.length > 1 ? currentInputValue.slice(0,-1) : "0");
document.getElementById('np-clear').onclick = () => updateDisplay("0");

document.getElementById("btn-qty-ok").onclick = () => sendVal(currentInputValue);
document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-panel").style.display = "none";
    document.getElementById("scanner-box").style.display = "block";
    startScanner('ean');
};

document.getElementById("order-val").onclick = () => startScanner('qr');
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => {
        if (res.status === "success") { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); }
    });
}
// Start QR po kliknięciu (User Gesture)
document.getElementById("order-val").click();
