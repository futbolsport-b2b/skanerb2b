// v42.8 - JS Ratunkowy
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzQR5-ZYU0eszM_BgW4tzIg_asx7RiQJBWWCshuckTgmFR1exqBqa3l3tDDhrwZez2d/exec"; 
let currentOrderID = null, targetItem = null;
const html5QrCode = new Html5Qrcode("reader");

async function fetchNext(offset) {
    const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
    if (res.status === "next_item") {
        targetItem = res.item;
        document.getElementById("task-lp").innerText = targetItem.lp;
        document.getElementById("task-name").innerText = targetItem.nazwa;
        document.getElementById("task-kat").innerText = targetItem.nr_kat;
        document.getElementById("task-qty").innerText = targetItem.pozostalo;
        document.getElementById("task-size").innerText = targetItem.rozmiar || "";
        document.getElementById("task-panel").style.display = "block";
    } else { alert("KONIEC"); location.reload(); }
}

function onScan(text) {
    const code = text.trim();
    if (!currentOrderID) {
        currentOrderID = code;
        document.getElementById("order-val").innerText = code;
        html5QrCode.stop().then(() => { document.getElementById("scanner-box").style.display = "none"; fetchNext(0); });
    } else if (code === targetItem.ean) {
        html5QrCode.stop().then(() => { document.getElementById("scanner-box").style.display = "none"; showQty(); });
    }
}

function showQty() {
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    document.getElementById("qty-kat-val").innerText = "Nr Kat: " + targetItem.nr_kat + " | ROZ: " + (targetItem.rozmiar || "---");
    document.getElementById("qty-modal").style.display = "flex";
}

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(() => { document.getElementById("qty-modal").style.display = "none"; fetchNext(0); });
}

document.getElementById("btn-qty-ok").onclick = () => sendVal(document.getElementById("qty-input").value);
document.getElementById("btn-scan-item").onclick = () => { 
    document.getElementById("task-panel").style.display = "none"; 
    document.getElementById("scanner-box").style.display = "block"; 
    document.getElementById("scanner-instruction").style.display = "block";
    document.getElementById("target-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("target-size-val").innerText = targetItem.rozmiar || "";
    html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
};

html5QrCode.start({ facingMode: "environment" }, { fps: 20 }, onScan);
