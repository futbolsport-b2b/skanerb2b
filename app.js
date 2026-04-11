const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztwhvZkWkLVSt4yfpalrAT7JYTqnSimlE3tRUH3GH3E7i3qIRUyX64T2gCMi1JWDSV/exec"; 
const IMAGE_BASE_URL = "https://b2b.futbolsport.pl/gfx-base/s_1/gfx/products/big/"; 

let currentOrderID = null, currentOffset = 0, targetItem = null, isProcessing = false;
let currentInputValue = "0"; 
const html5QrCode = new Html5Qrcode("reader");

let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (err) {}
}
document.addEventListener('visibilitychange', () => {
    if (wakeLock === null && document.visibilityState === 'visible') requestWakeLock();
});
requestWakeLock();

function speakVoice(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.rate = 1.1; 
        window.speechSynthesis.speak(utterance);
    }
}

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
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'error') {
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.15); 
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function triggerScanVisual(type) {
    const sv = document.getElementById("scanner-visual");
    if(sv) {
        sv.className = type === 'success' ? 'scan-success' : 'scan-error';
        setTimeout(() => { sv.className = ''; }, 400); 
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

let torchOn = false;
document.getElementById('btn-torch').onclick = async () => {
    torchOn = !torchOn;
    try {
        await html5QrCode.applyVideoConstraints({ advanced: [{ torch: torchOn }] });
        document.getElementById('btn-torch').classList.toggle('active', torchOn);
    } catch(e) {
        torchOn = false;
        alert("Latarka nie jest obsługiwana w tym trybie kamery.");
    }
};

async function fetchNext(offset) {
    setLoadingState(true); 
    currentOffset = offset;
    try {
        const res = await fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&action=get_next&offset=${offset}`).then(r => r.json());
        
        if(res.progress !== undefined) {
            document.getElementById("global-progress-fill").style.width = res.progress + "%";
        }

        if (res.status === "next_item") {
            targetItem = res.item; 
            currentOffset = res.current_offset;
            setTimeout(() => {
                const m = document.getElementById("qty-modal");
                if (m.style.display === "flex") {
                    m.style.display = "none";
                    document.getElementById("btn-qty-ok").classList.remove("is-loading");
                    document.getElementById("btn-qty-ok").disabled = false;
                }

                document.getElementById("task-lp").innerText = targetItem.lp; 
                document.getElementById("task-name").innerText = targetItem.nazwa;
                document.getElementById("task-kat").innerText = targetItem.nr_kat; 
                document.getElementById("task-qty").innerText = targetItem.pozostalo;
                document.getElementById("task-size").innerText = targetItem.rozmiar || "---";
                
                const imgBox = document.getElementById("product-image-box");
                const imgElem = document.getElementById("task-img");
                imgElem.src = "";
                
                if(targetItem.nr_kat && targetItem.nr_kat !== "---") {
                    let formattedKat = String(targetItem.nr_kat).trim().replace(/[\s\-]+/g, '_');
                    let finalImageUrl = IMAGE_BASE_URL + "1_" + formattedKat + ".jpg";
                    
                    imgElem.onload = () => { imgBox.style.display = "flex"; };
                    imgElem.onerror = () => { imgBox.style.display = "none"; }; 
                    imgElem.src = finalImageUrl;
                } else {
                    imgBox.style.display = "none";
                }

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
            speakVoice("Zamówienie kompletne!");
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
        
        document.getElementById("brand-title").style.display = "none"; 
        const orderValElem = document.getElementById("order-val");
        orderValElem.innerText = code;
        orderValElem.classList.remove("breathing"); 
        orderValElem.style.textAlign = "left";
        orderValElem.style.fontSize = "26px";
        orderValElem.style.color = "#fff"; 
        orderValElem.style.cursor = "default";
        orderValElem.onclick = null; // Czyszczenie ew. listenera po uruchomieniu ręcznym
        
        document.getElementById("global-progress-bar").style.display = "block"; 

        setTimeout(() => { 
            html5QrCode.stop().then(() => { 
                document.getElementById("scanner-box").style.display = "none"; 
                document.getElementById("btn-torch").style.display = "none";
                document.getElementById("btn-finish-icon").style.display = "flex"; 
                fetchNext(0); 
            }); 
        }, 300); 
    } else if (code === targetItem.ean) {
        isProcessing = true;
        playSound('success');
        triggerScanVisual('success');
        setTimeout(() => { 
            html5QrCode.stop().then(() => { 
                document.getElementById("scanner-box").style.display = "none"; 
                document.getElementById("btn-torch").style.display = "none";
                
                if (targetItem.pozostalo > 1) {
                    showQty(); 
                } else {
                    sendVal(1); 
                }
            }); 
        }, 300); 
    } else { 
        triggerScanVisual('error');
        showError("BŁĘDNY PRODUKT"); 
    }
}

// === FIX 43.5: Obsługa błędu inicjalizacji kamery ===
async function startQR() { 
    isProcessing = false; 
    document.body.className = "qr-mode"; 
    document.getElementById("scanner-instruction").style.display = "none"; 
    document.getElementById("btn-torch").style.display = "none"; 
    
    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
        // Sukces kamery: Przywróć stan pierwotny, jeśli był wcześniej błąd
        const orderValElem = document.getElementById("order-val");
        orderValElem.innerText = "ZESKANUJ KOD QR";
        orderValElem.style.cursor = "default";
        orderValElem.onclick = null;
    } catch (err) {
        // Blokada przeglądarki ze względów bezpieczeństwa - wymaga User Gesture
        console.warn("Wymagana zgoda na kamerę:", err);
        const orderValElem = document.getElementById("order-val");
        orderValElem.innerText = "KLIKNIJ, ABY WŁĄCZYĆ KAMERĘ";
        orderValElem.style.cursor = "pointer";
        orderValElem.onclick = () => startQR(); // Ponowne wywołanie już z uprawnieniem kliknięcia
    }
}

async function startEAN() {
    isProcessing = false; 
    document.body.className = "ean-mode"; 
    document.getElementById("target-kat-val").innerText = targetItem.nr_kat;
    document.getElementById("target-size-val").innerText = targetItem.rozmiar || "---"; 
    document.getElementById("scanner-instruction").style.display = "block";
    document.getElementById("btn-torch").style.display = "flex"; 
    document.getElementById("btn-torch").classList.remove('active');
    torchOn = false;
    
    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 25 }, onScan);
    } catch (e) {
        showError("BŁĄD KAMERY");
    }
}

function updateDisplay(val) {
    currentInputValue = String(val);
    document.getElementById("qty-input-display").innerText = currentInputValue;
}

function flashDisplayError() {
    playSound('error');
    speakVoice("Zły produkt"); 
    const disp = document.getElementById("qty-input-display");
    disp.classList.add("flash-error");
    setTimeout(() => disp.classList.remove("flash-error"), 300);
}

document.querySelectorAll('.np-btn[data-val]').forEach(btn => {
    btn.onclick = () => {
        let digit = btn.getAttribute('data-val');
        let newVal = currentInputValue === "0" ? digit : currentInputValue + digit;
        if (parseInt(newVal) > targetItem.pozostalo) {
            flashDisplayError();
        } else {
            updateDisplay(newVal);
        }
    };
});

document.getElementById('np-del').onclick = () => {
    let newVal = currentInputValue.slice(0, -1);
    updateDisplay(newVal === "" ? "0" : newVal);
};

document.getElementById('np-clear').onclick = () => updateDisplay("0");

document.querySelectorAll('.btn-quick[data-add]').forEach(btn => {
    btn.onclick = () => {
        let addVal = parseInt(btn.getAttribute('data-add'));
        let newVal = parseInt(currentInputValue) + addVal;
        
        if (newVal > targetItem.pozostalo) {
            playSound('error'); 
            speakVoice("Zły produkt");
            btn.classList.add('flash-error'); 
            setTimeout(() => { btn.classList.remove('flash-error'); }, 300); 
        } else {
            updateDisplay(newVal);
        }
    };
});

document.getElementById('btn-quick-max').onclick = () => updateDisplay(targetItem.pozostalo);

function showQty() {
    const m = document.getElementById("qty-modal"); 
    document.getElementById("qty-name").innerText = targetItem.nazwa;
    
    const sizeDisplay = targetItem.rozmiar || "---";
    document.getElementById("qty-kat-val").innerHTML = "Nr Kat: <span class='kat-number'>" + targetItem.nr_kat + "</span> <span class='meta-separator'>|</span> Roz: <span class='size-number'>" + sizeDisplay + "</span>"; 
    document.getElementById("qty-remain").innerText = targetItem.pozostalo;
    
    document.getElementById("btn-qty-ok").classList.remove("is-loading");
    document.getElementById("btn-qty-ok").disabled = false;

    updateDisplay("0"); 
    m.style.display = "flex"; 
    
    speakVoice(`Pobierz ${targetItem.pozostalo} sztuk`);
}

function sendVal(q) {
    if(!q || isNaN(q) || parseInt(q) <= 0) { flashDisplayError(); return; }

    const btnOk = document.getElementById("btn-qty-ok");
    btnOk.classList.add("is-loading");
    btnOk.disabled = true;

    fetch(`${SCRIPT_URL}?orderID=${encodeURIComponent(currentOrderID)}&ean=${encodeURIComponent(targetItem.ean)}&qty=${q}&action=validate`)
    .then(r => r.json()).then(res => { 
        if (res.status === "success") { 
            let qInt = parseInt(q);
            if (qInt >= targetItem.pozostalo) {
                speakVoice("Zatwierdzono pełne pobranie");
            } else {
                speakVoice(`Zatwierdzono ${qInt} sztuk`);
            }
            fetchNext(currentOffset); 
        } else { 
            btnOk.classList.remove("is-loading");
            btnOk.disabled = false;
            showError(res.msg); 
        } 
    });
}

function showError(m) { 
    isProcessing = true; 
    playSound('error'); 
    speakVoice("Zły produkt"); 
    const o = document.getElementById("error-overlay"); 
    document.getElementById("error-text").innerText = m; 
    o.style.display = "flex"; 
    setTimeout(() => { o.style.display = "none"; isProcessing = false; }, 1500); 
}

let touchStartX = 0;
const taskPanel = document.getElementById('task-panel');
taskPanel.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
taskPanel.addEventListener('touchend', e => {
    let touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50 && !isProcessing) fetchNext(currentOffset + 1); 
    if (touchEndX > touchStartX + 50 && !isProcessing) fetchNext(currentOffset - 1); 
}, {passive: true});

document.getElementById("btn-qty-ok").onclick = () => sendVal(currentInputValue);
document.getElementById("btn-scan-item").onclick = () => { document.getElementById("task-panel").style.display = "none"; document.getElementById("scanner-box").style.display = "block"; startEAN(); };
document.getElementById("btn-prev").onclick = () => fetchNext(currentOffset - 1);
document.getElementById("btn-next").onclick = () => fetchNext(currentOffset + 1);
document.getElementById("btn-finish-icon").onclick = () => { if(confirm("Zakończyć to zamówienie?")) location.reload(); };
document.getElementById("btn-qty-cancel").onclick = () => { document.getElementById("qty-modal").style.display = "none"; fetchNext(currentOffset); };

document.body.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}, { once: true });

startQR();
