const resultInput = document.getElementById('ean-result');
const btnScan = document.getElementById('btn-scan');
const debugLog = document.getElementById('debug-log');

let isScanning = false;

btnScan.addEventListener('click', () => {
    if (!isScanning) {
        startScanner();
    } else {
        Quagga.stop();
        isScanning = false;
        btnScan.innerText = "URUCHOM SKANER";
    }
});

function startScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: {
                facingMode: "environment", // Tylna kamera
                aspectRatio: { min: 1, max: 2 }
            },
        },
        decoder: {
            readers: ["ean_reader"] // Tylko EAN-13 dla wydajności
        },
        locate: true // Pomaga odnaleźć kod w kadrze
    }, function(err) {
        if (err) {
            debugLog.innerText = "Błąd: " + err;
            return;
        }
        Quagga.start();
        isScanning = true;
        btnScan.innerText = "ZATRZYMAJ";
        debugLog.innerText = "Skaner aktywny...";
    });
}

Quagga.onDetected((data) => {
    const code = data.codeResult.code;
    resultInput.value = code;
    
    // Dźwięk potwierdzenia
    beep();
    
    debugLog.innerText = "Zeskanowano: " + code;
    
    // Krótka pauza, by nie skanować tego samego kodu 100 razy
    Quagga.stop();
    setTimeout(() => { Quagga.start(); }, 1500);
});

function beep() {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(600, actx.currentTime);
    osc.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.1);
}