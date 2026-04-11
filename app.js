const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztwhvZkWkLVSt4yfpalrAT7JYTqnSimlE3tRUH3GH3E7i3qIRUyX64T2gCMi1JWDSV/exec"; 
const IMAGE_BASE_URL = "https://b2b.futbolsport.pl/gfx-base/s_1/gfx/products/big/"; 

let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
let currentInputValue = "0"; 
const html5QrCode = new Html5Qrcode("reader");

function goFullscreen() {
    const doc = document.documentElement;
    if (doc.requestFullscreen) doc.requestFullscreen();
    else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
}

function speakVoice(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = 'pl-PL';
        ut.rate = 1.1;
        window.speechSynthesis.speak(ut);
    }
}

let audioCtx = null;
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else {
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}

async function fetchNext(offset) {
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if(res.progress !== undefined) document.getElementById("global-progress-fill").style.width = res.progress + "%";
        
        if (res.status === "next_item") {
            targetItem = res.item; currentOffset = res.current_offset;
            document.getElementById("task-lp").innerText = targetItem.lp;
            document.getElementById("task-name").innerText = targetItem.nazwa;
            document.getElementById("task-kat").innerText = targetItem.nr_kat;
            document.getElementById("task-size").innerText = targetItem.rozmiar || "---";
            
            const qtyElem = document.getElementById("task-qty");
            qtyElem.innerText = targetItem.pozostalo;
            const notesRow = document.getElementById("task-notes-row");
            if (targetItem.uwagi && targetItem.uwagi.trim() !== "") {
                document.getElementById("task-notes").innerText = targetItem.uwagi;
                notesRow.style.display = "block";
                qtyElem.style.color = "var(--error)";
            } else {
                notesRow.style.display = "none";
                qtyElem.style.color = "var(--success)";
            }

            const imgBox = document.getElementById("product-image-box");
            const imgElem = document.getElementById("task-img");
            const katFormatted = String(targetItem.nr_kat).replace(/\s+/g, '_');
            imgElem.src = `${IMAGE_BASE_URL}1_${katFormatted}.jpg`;
            imgElem.onload = () => imgBox.style.display = "flex";
            imgElem.onerror = () => imgBox.style.display = "none";

            document.getElementById("task-panel").style.display = "block";
            isProcessing = false;
        } else { alert("ZAKOŃCZONO"); location.reload(); }
    } catch (e) { isProcessing = false; }
}

function onScan(text) {
    if (isProcessing) return;
    const code = text.trim();
    if (!currentOrderID) {
        isProcessing = true;
        currentOrderID = code;
        const ov = document.getElementById("order-val");
        ov.innerHTML = `${code}<br><span style="font-size:14px;">DOTKNIJ ABY ROZPOCZĄĆ</span>`;
        ov.onclick = () => {
            goFullscreen();
            ov.innerHTML = code; ov.onclick = null; ov.classList.remove("breathing");
            document.getElementById("brand-title").style.display = "none";
            document.getElementById("global-progress-bar").style.display = "block";
            document.getElementById("btn-finish-icon").style.display = "flex";
            html5QrCode.stop().then(() => { document.getElementById("scanner-box").style.display = "none"; fetchNext(0); });
        };
    } else if (code === targetItem.ean) {
        isProcessing = true; playSound('success');
        html5QrCode.stop().then(() => {
            document.getElementById("scanner-box").style.display = "none";
            if (targetItem.pozostalo > 1) {
                document.getElementById("qty-modal").style.display = "flex";
                document.getElementById("qty-name").innerText = targetItem.nazwa;
                document.getElementById("qty-kat-val").innerText = "Nr Kat: " + targetItem.nr_kat;
                document.getElementById("qty-remain").innerText = targetItem.pozostalo;
                updateDisplay("0");
                speakVoice(`Pobierz ${targetItem.pozostalo} sztuk`);
            } else { sendVal(1); }
        });
    } else { speakVoice("Zły produkt"); playSound('error'); }
}

function updateDisplay(v) { currentInputValue = v; document.getElementById("qty-input-display").innerText = v; }

document.querySelectorAll('.np-btn[data-val]').forEach(b => {
    b.onclick = () => {
        let n = currentInputValue === "0" ? b.dataset.val : currentInputValue + b.dataset.val;
        if (parseInt(n) <= targetItem.pozostalo) updateDisplay(n);
        else { speakVoice("Niewłaściwa ilość"); playSound('error'); }
    }
});
document.getElementById('np-del').onclick = () => updateDisplay(currentInputValue.length > 1 ? currentInputValue.slice(0,-1) : "0");
document.getElementById('np-clear').onclick = () => updateDisplay("0");
document.querySelectorAll('.btn-quick[data-add]').forEach(b => {
    b.onclick = () => {
        let n = parseInt(currentInputValue) + parseInt(b.dataset.add);
        if (n <= targetItem.pozostalo) updateDisplay(String(n));
        else { speakVoice("Niewłaściwa ilość"); playSound('error'); }
    }
});
document.getElementById('btn-quick-max').onclick = () => updateDisplay(String(targetItem.pozostalo));

function sendVal(q) {
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => {
        if (res.status === "success") {
            speakVoice(parseInt(q) >= targetItem.pozostalo ? "Zatwierdzono pełne pobranie" : `Zatwierdzono ${q} sztuk`);
            document.getElementById("qty-modal").style.display = "none";
            fetchNext(currentOffset);
        }
    });
}

document.getElementById("btn-qty-ok").onclick = () => sendVal(currentInputValue);
document.getElementById("btn-scan-item").onclick = () => {
    document.getElementById("task-panel").style.display = "none";
    document.getElementById("scanner-box").style.display = "block";
    html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: 250 }, onScan);
};
document.getElementById("task-img").onclick = () => {
    const ov = document.getElementById("image-zoom-overlay");
    document.getElementById("zoomed-img").src = document.getElementById("task-img").src;
    ov.style.display = "flex";
    setTimeout(() => ov.style.display = "none", 3000);
};
document.getElementById("image-zoom-overlay").onclick = () => document.getElementById("image-zoom-overlay").style.display = "none";
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => confirm("Zakończyć?") && location.reload();
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

html5QrCode.start({ facingMode: "environment" }, { fps: 25, qrbox: 250 }, onScan).catch(() => {
    const ov = document.getElementById("order-val");
    ov.innerText = "KLIKNIJ, ABY WŁĄCZYĆ KAMERĘ";
    ov.onclick = () => location.reload();
});
