const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxkgmQm20tpZL4ppUfgDlrnJ10TyPzr-sLa33uMO8xtIAVwcION9yXOWi6Q7dfYlGzAvg/exec";
let currentOrderID = null;
let targetItem = null;
let isProcessing = false;

const html5QrCode = new Html5Qrcode("reader");

// 1. START: Skanowanie QR (Duży kwadrat)
async function initOrderScanner() {
    document.body.classList.remove("ean-mode");
    document.getElementById("camera-wrapper").style.display = "block";
    const config = { 
        fps: 20, 
        qrbox: { width: 280, height: 280 } // Duży celownik kwadratowy
    };
    await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

// 2. SKANER PRODUKTÓW (Wąski prostokąt + laser)
async function startEanScanner() {
    if (html5QrCode.isScanning) await html5QrCode.stop();
    document.body.classList.add("ean-mode");
    document.getElementById("camera-wrapper").style.display = "block";
    
    const config = { 
        fps: 25, 
        qrbox: { width: 320, height: 120 }, // Wąski celownik prostokątny
        aspectRatio: 1.77 // Sugestia dla lepszego dopasowania EAN
    };
    
    // Obsługiwane formaty: EAN, Code 128, Code 39
    await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    const code = decodedText.trim();

    // Rozpoznanie zamówienia
    if (!currentOrderID) {
        if (code.includes("/") || code.includes("DHH")) {
            currentOrderID = code;
            playBeep(880, 100);
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                document.getElementById("btn-finish-order").style.display = "block";
                document.getElementById("order-title").innerText = "ZAMÓWIENIE ZNALEZIONE";
                fetchNextItem();
            });
        }
        return;
    }

    // Rozpoznanie produktu
    if (currentOrderID) {
        if (code === targetItem.ean) {
            isProcessing = true;
            playBeep(880, 100);
            html5QrCode.stop().then(() => {
                document.getElementById("camera-wrapper").style.display = "none";
                if (targetItem.pozostalo > 1) {
                    showQtyPanel();
                } else {
                    sendValidation(1);
                }
            });
        } else {
            updateStatus("BŁĘDNY PRODUKT! Oczekiwano: " + targetItem.nr_kat);
            playBeep(200, 500);
            flashUI("#ff453a");
        }
    }
}

function fetchNextItem() {
    updateStatus("Szukam następnej pozycji...");
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "next_item") {
                targetItem = res;
                displayTask(res);
            } else {
                alert(res.msg);
                location.reload();
            }
        });
}

function displayTask(item) {
    document.getElementById("task-card").style.display = "block";
    document.getElementById("task-lp").innerText = item.lp;
    document.getElementById("task-nazwa").innerText = item.nazwa;
    document.getElementById("task-kat").innerText = "NR KAT: " + item.nr_kat;
    document.getElementById("task-qty").innerText = item.pozostalo + " szt.";
}

document.getElementById("btn-trigger-scan").onclick = () => {
    document.getElementById("task-card").style.display = "none";
    startEanScanner();
};

function showQtyPanel() {
    document.getElementById("qty-panel").style.display = "block";
    const input = document.getElementById("quantity-input");
    input.value = 1;
    setTimeout(() => { input.focus(); input.select(); }, 200);
}

document.getElementById("btn-confirm-qty").onclick = () => {
    const qty = document.getElementById("quantity-input").value;
    sendValidation(qty);
};

function sendValidation(qty) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${qty}&action=validate`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success") {
                document.getElementById("qty-panel").style.display = "none";
                flashUI("#30d158");
                isProcessing = false;
                fetchNextItem();
            } else {
                alert(res.msg);
                playBeep(200, 600);
            }
        });
}

function updateStatus(m) { document.getElementById("status-msg").innerText = m; }
function flashUI(c) { document.body.style.background = c; setTimeout(() => document.body.style.background = "#000", 800); }
function playBeep(f, d) { try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = f; o.connect(c.destination); o.start(); o.stop(c.currentTime + (d/1000)); } catch(e) {} }

initOrderScanner();
