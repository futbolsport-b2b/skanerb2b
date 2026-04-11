const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbznw5fK99kxqzCwcGXDjAfn-E2h8Lre3khmPIQivB3snBPugZufk1k-5LlRzxbLrRlU/exec"; 
let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
const html5QrCode = new Html5Qrcode("reader");

let audioCtx = null;
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Dźwięk A5
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'error') {
        // Łagodniejszy, krótki, podwójny sygnał ostrzegawczy
        osc.type = 'triangle';
        
        // Pierwszy dźwięk (0.0s do 0.1s)
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        // Drugi dźwięk (0.15s do 0.25s)
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.15); 
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Funkcja dodająca kolor zielony/czerwony na celowniku
function triggerScanVisual(type) {
    const sv = document.getElementById("scanner-visual");
    if(sv) {
        sv.className = type === 'success' ? 'scan-success' : 'scan-error';
        setTimeout(() => { sv.className = ''; }, 400); // Wróć do bieli po 400ms
    }
}

function setLoadingState(active) { 
    const card = document.querySelector('.task-card'); 
    if (active) { 
        card.classList.add('loading-mode'); 
        isProcessing = true; 
    } else { 
        card.classList.remove('loading-mode'); 
        isProcessing = false; 
    } 
}

async function fetchNext(offset) {
    setLoadingState(true); 
    currentOffset = offset;
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        if (res.status === "next_item") {
            targetItem = res.item; 
            currentOffset = res.current_offset;
            setTimeout(() => {
                document.getElementById("task-lp").innerText = targetItem.lp; 
                document.getElementById("task-name").innerText = targetItem.nazwa;
                document.getElementById("task-kat").innerText = targetItem.nr_kat; 
                document.getElementById("task-qty").innerText = targetItem.pozostalo;
                document.getElementById("task-size").innerText = targetItem.rozmiar || "---";
                const notesRow = document.getElementById("task-notes-row");
                if (targetItem.uwagi && targetItem.uwagi.trim() !== "") { 
                    document.getElementById("task-notes").innerText = targetItem.uwagi; 
                    notesRow.style.display = "block"; 
                } else { 
                    notesRow.style.display = "none"; 
                }
                document.getElementById("task-panel").style.display = "block"; 
                setLoadingState(false);
            }, 350);
        } else { 
            playSound('success'); 
            alert("ZAMÓWIENIE ZREALIZOWANE"); 
            location.reload(); 
        }
    } catch (e) { 
        setLoadingState(false); 
    }
}

function onScan(text) {
    if (isProcessing) return; 
    const code = text.trim();
    if (!currentOrderID) {
        isProcessing = true; 
        playSound('success');
        triggerScanVisual('success');
        currentOrderID = code; 
        document.getElementById("order-val").innerText = code;
        setTimeout(() => { 
            html5QrCode.stop().then(() => { 
                document.getElementById("scanner-box").style.display = "none"; 
                document.getElementById("btn-finish-icon").style.display = "flex"; 
                fetchNext(0); 
            }); 
        }, 300); // Wydłużono z 150ms do 300ms, by pracownik zauważył zieloną ramkę
    } else if (code === targetItem.ean) {
        isProcessing = true;
        playSound('success');
        triggerScanVisual('success');
        setTimeout(() => { 
            html5QrCode.stop().then(() => { 
                document.getElementById("scanner-box").style.display = "none"; 
                if (targetItem.pozostalo > 1) showQty(); 
                else sendVal(1); 
            }); 
        }, 300); 
    } else { 
        triggerScanVisual('error');
        showError("BŁĘDNY PRODUKT"); 
    }
}

async function startQR() { 
    isProcessing = false; 
    document.body.className = "qr-mode"; 
    document.getElementById("scanner-instruction").style.display = "none"; 
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan); 
}

async function startEAN() {
    isProcessing = false; 
    document.body.className = "ean-mode"; 
    document.getElementById("target-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("target-size-val").innerText = targetItem.rozmiar || "---"; 
    document.getElementById("scanner-instruction").style.display = "block";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
}

function showQty() {
    const m = document.getElementById("qty-modal"); 
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    
    const sizeDisplay = targetItem.rozmiar || "---";
    document.getElementById("qty-kat-val").innerHTML = "Nr Kat: <span class='kat-number'>" + targetItem.nr_kat + "</span> <span class='meta-separator'>|</span> Roz: <span class='size-number'>" + sizeDisplay + "</span>"; 
    
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    m.style.display = "flex"; 
    const i = document.getElementById("qty-input"); 
    i.value = ""; 
    setTimeout(() => { i.focus(); i.click(); }, 150);
}

function sendVal(q) {
    if(!q || isNaN(q) || parseInt(q) <= 0) return; // Zabezpieczenie przed wysłaniem pustego/zerowego pola
    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => { 
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
    playSound('error'); 
    const o = document.getElementById("error-overlay"); 
    document.getElementById("error-text").innerText = m; 
    o.style.display = "flex"; 
    setTimeout(() => { o.style.display = "none"; isProcessing = false; }, 1500); 
}

document.querySelectorAll('.btn-quick[data-add]').forEach(btn => {
    btn.onclick = () => {
        const input = document.getElementById("qty-input");
        let currentVal = parseInt(input.value) || 0;
        let addVal = parseInt(btn.getAttribute('data-add'));
        let newVal = currentVal + addVal;
        if (newVal > targetItem.pozostalo) newVal = targetItem.pozostalo;
        input.value = newVal;
    };
});
document.getElementById('btn-quick-max').onclick = () => {
    document.getElementById("qty-input").value = targetItem.pozostalo;
};

document.getElementById("btn-qty-ok").onclick = () => sendVal(document.getElementById("qty-input").value);
document.getElementById("btn-scan-item").onclick = () => { document.getElementById("task-panel").style.display = "none"; document.getElementById("scanner-box").style.display = "block"; startEAN(); };
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Anulować?")) location.reload(); };
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

document.body.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

startQR();
