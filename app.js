const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwL9WvrgYCGl4q_Drdh32kp_6kajwAHWNO8jiB57uq2hLUO-DU2UyNklQ6b0GgHofDELg/exec"; 
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
const html5QrCode = new Html5Qrcode("reader");

function resetProductUI() {
    isProcessing = true;
    document.getElementById("task-card").classList.add("loading-state");
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
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
}

async function startEAN() {
    isProcessing = false;
    document.body.classList.remove("qr-mode");
    document.body.classList.add("ean-mode");
    
    // Wyświetl numer katalogowy nad skanerem
    document.getElementById("target-kat-display").innerText = targetItem.nr_kat;
    document.getElementById("scanner-instruction").style.display = "block";
    
    setCornersColor("white");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();

    if (!currentOrderID) {
        isProcessing = true;
        setCornersColor("#30d158");
        playBeep(880, 100);
        currentOrderID = code;
        document.getElementById("order-val").innerText = code;
        setTimeout(() => {
            html5QrCode.stop().then(() => {
                document.getElementById("camera-section").style.display = "none";
                document.getElementById("btn-finish-icon").style.display = "flex";
                fetchNext(0);
            });
        }, 150);
    } else if (code === targetItem.ean) {
        isProcessing = true;
        setCornersColor("#30d158");
        playBeep(880, 100);
        setTimeout(() => {
            html5QrCode.stop().then(() => {
                document.getElementById("camera-section").style.display = "none";
                document.getElementById("scanner-instruction").style.display = "none";
                if (targetItem.pozostalo > 1) showQty();
                else sendVal(1);
            });
        }, 150);
    } else {
        showError("BŁĘDNY PRODUKT");
    }
}

// OPTYMALIZACJA: Caching & Fast Data Rendering
async function fetchNext(offset) {
    resetProductUI();
    currentOffset = offset;
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if (res.status === "next_item") {
            targetItem = res.item;
            currentOffset = res.current_offset;
            
            // Renderuj dane błyskawicznie
            document.getElementById("task-lp").innerText = targetItem.lp;
            document.getElementById("task-name").innerText = targetItem.nazwa;
            document.getElementById("task-kat").innerText = "KATALOG: " + targetItem.nr_kat;
            document.getElementById("task-qty").innerText = targetItem.pozostalo;
            
            document.getElementById("task-card").classList.remove("loading-state");
            document.getElementById("task-card").style.display = "block";
            isProcessing = false;
        } else {
            alert("ZREALIZOWANO");
            location.reload();
        }
    } catch (e) { isProcessing = false; }
}

function showQty() {
    const p = document.getElementById("qty-modal");
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    document.getElementById("qty-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    p.style.display = "flex";
    const inp = document.getElementById("qty-input");
    inp.value = "";
    setTimeout(() => { inp.focus(); inp.click(); }, 100);
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
    setCornersColor("#ff3b30");
    playBeep(200, 600);
    const o = document.getElementById("error-overlay");
    document.getElementById("error-text").innerText = m;
    o.style.display = "flex";
    setTimeout(() => { 
        o.style.display = "none"; 
        isProcessing = false; 
        setCornersColor("white"); 
    }, 1500);
}

function setCornersColor(c) { 
    document.querySelectorAll('.corner').forEach(e => e.style.borderColor = c); 
}

document.getElementById("btn-qty-ok").onclick = () => sendVal(document.getElementById("qty-input").value);
document.getElementById("btn-scan-item").onclick = () => { 
    document.getElementById("task-card").style.display = "none"; 
    document.getElementById("camera-section").style.display = "block"; 
    startEAN(); 
};
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

startQR();
