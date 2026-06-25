const video = document.getElementById("camera");
const overlayCanvas = document.getElementById("overlayCanvas");
const overlayCtx = overlayCanvas.getContext("2d");

const captureCanvas = document.getElementById("captureCanvas");
const captureCtx = captureCanvas.getContext("2d");

const statusText = document.getElementById("statusText");
const statusSub = document.getElementById("statusSub");
const statusDot = document.getElementById("statusDot");

const captureBtn = document.getElementById("captureBtn");
const resultScreen = document.getElementById("resultScreen");
const resultImage = document.getElementById("resultImage");
const retakeBtn = document.getElementById("retakeBtn");
const downloadBtn = document.getElementById("downloadBtn");

let animationId = null;
let lastCapturedDataUrl = null;

/* =========================================================
   ASSETS
========================================================= */
const ghostOverlay = new Image();
ghostOverlay.src = "./assets/overlays/ghost.png";

const posterBg = new Image();
posterBg.src = "./assets/poster/poster-bg.png";

let posterReady = false;

posterBg.onload = () => {
    posterReady = true;
    console.log("poster bg loaded");
};

posterBg.onerror = () => {
    console.error("โหลด poster-bg.png ไม่ได้");
};

/* =========================================================
   CONFIG
========================================================= */

/*
  guide = กรอบเส้นประตอน live camera
  ตอนนี้ย้ายไป "ฝั่งซ้าย" แล้ว
*/
const guide = {
    x: 0.10,
    y: 0.18,
    w: 0.26,
    h: 0.58
};

/*
  finalPosterLayout.slot = ตำแหน่ง "เฟรมเล็กฝั่งซ้าย"
  ในภาพโปสเตอร์ final

  ต้องปรับให้ตรงกับ poster-bg.png ของมึง
*/
const finalPosterLayout = {
    slot: {
        x: 0.10,
        y: 0.17,
        w: 0.28,
        h: 0.60
    },

    overlayInset: {
        x: 0.05,
        y: 0.05
    }
};

// ถ้าอยากให้ overlay เข้มขึ้น/เบาลง ปรับตรงนี้
const overlayOpacity = 0.95;

/* =========================================================
   CAMERA INIT
========================================================= */
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        video.srcObject = stream;

        await new Promise((resolve) => {
            video.onloadedmetadata = () => resolve();
        });

        resizeCanvases();
        window.addEventListener("resize", resizeCanvases);

        setStatus(
            "พร้อมถ่าย",
            "เอากระดาษไปวางในกรอบฝั่งซ้าย แล้วกด CAPTURE",
            true
        );
    } catch (error) {
        console.error("Camera error:", error);
        setStatus(
            "เปิดกล้องไม่สำเร็จ",
            error.message || "ไม่สามารถเข้าถึงกล้องได้",
            false
        );
    }
}

function resizeCanvases() {
    const rect = video.getBoundingClientRect();
    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;

    captureCanvas.width = video.videoWidth || rect.width;
    captureCanvas.height = video.videoHeight || rect.height;
}

/* =========================================================
   STATUS
========================================================= */
function setStatus(title, sub, ready = false) {
    statusText.textContent = title;
    statusSub.textContent = sub;
    statusDot.classList.toggle("ready", ready);
}

/* =========================================================
   HELPERS
========================================================= */
function getGuideRect(canvasW, canvasH) {
    return {
        x: canvasW * guide.x,
        y: canvasH * guide.y,
        w: canvasW * guide.w,
        h: canvasH * guide.h
    };
}

function getPosterSlotRect(outW, outH) {
    return {
        x: outW * finalPosterLayout.slot.x,
        y: outH * finalPosterLayout.slot.y,
        w: outW * finalPosterLayout.slot.w,
        h: outH * finalPosterLayout.slot.h
    };
}

function getOverlayInnerRect(slotRect) {
    const padX = slotRect.w * finalPosterLayout.overlayInset.x;
    const padY = slotRect.h * finalPosterLayout.overlayInset.y;

    return {
        x: slotRect.x + padX,
        y: slotRect.y + padY,
        w: slotRect.w - padX * 2,
        h: slotRect.h - padY * 2
    };
}

/* =========================================================
   LIVE HUD : กล้องเต็มจอ + กรอบซ้าย
========================================================= */
function drawHUD() {
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    overlayCtx.clearRect(0, 0, w, h);

    // มืดรอบนอกนิดหน่อย
    overlayCtx.fillStyle = "rgba(0,0,0,0.16)";
    overlayCtx.fillRect(0, 0, w, h);

    const rect = getGuideRect(w, h);

    // เปิดเฉพาะช่องกรอบ
    overlayCtx.clearRect(rect.x, rect.y, rect.w, rect.h);

    // เส้นประ
    overlayCtx.save();
    overlayCtx.strokeStyle = "rgba(255,255,255,0.96)";
    overlayCtx.lineWidth = 3;
    overlayCtx.setLineDash([14, 10]);
    overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // มุมเรือง ๆ
    overlayCtx.setLineDash([]);
    overlayCtx.strokeStyle = "#8fe7ff";
    overlayCtx.lineWidth = 5;
    const c = 30;

    // TL
    overlayCtx.beginPath();
    overlayCtx.moveTo(rect.x, rect.y + c);
    overlayCtx.lineTo(rect.x, rect.y);
    overlayCtx.lineTo(rect.x + c, rect.y);
    overlayCtx.stroke();

    // TR
    overlayCtx.beginPath();
    overlayCtx.moveTo(rect.x + rect.w - c, rect.y);
    overlayCtx.lineTo(rect.x + rect.w, rect.y);
    overlayCtx.lineTo(rect.x + rect.w, rect.y + c);
    overlayCtx.stroke();

    // BL
    overlayCtx.beginPath();
    overlayCtx.moveTo(rect.x, rect.y + rect.h - c);
    overlayCtx.lineTo(rect.x, rect.y + rect.h);
    overlayCtx.lineTo(rect.x + c, rect.y + rect.h);
    overlayCtx.stroke();

    // BR
    overlayCtx.beginPath();
    overlayCtx.moveTo(rect.x + rect.w - c, rect.y + rect.h);
    overlayCtx.lineTo(rect.x + rect.w, rect.y + rect.h);
    overlayCtx.lineTo(rect.x + rect.w, rect.y + rect.h - c);
    overlayCtx.stroke();

    overlayCtx.restore();
}

/* =========================================================
   FLASH
========================================================= */
function triggerFlash() {
    const flash = document.createElement("div");
    flash.style.position = "fixed";
    flash.style.inset = "0";
    flash.style.background = "#fff";
    flash.style.opacity = "0";
    flash.style.pointerEvents = "none";
    flash.style.zIndex = "9999";
    flash.style.transition = "opacity 120ms ease";
    document.body.appendChild(flash);

    requestAnimationFrame(() => {
        flash.style.opacity = "0.92";
        setTimeout(() => {
            flash.style.opacity = "0";
            setTimeout(() => flash.remove(), 180);
        }, 90);
    });
}

/* =========================================================
   GET CAMERA FRAME (mirror ให้ตรงกับที่เห็นบนจอ)
========================================================= */
function getCurrentCameraFrameCanvas() {
    const temp = document.createElement("canvas");
    temp.width = video.videoWidth;
    temp.height = video.videoHeight;

    const tctx = temp.getContext("2d");
    tctx.save();
    tctx.translate(temp.width, 0);
    tctx.scale(-1, 1);
    tctx.drawImage(video, 0, 0, temp.width, temp.height);
    tctx.restore();

    return temp;
}

/* =========================================================
   CROP เฉพาะส่วนในกรอบเส้นประจากกล้อง
========================================================= */
function cropGuideFromCameraFrame(cameraCanvas) {
    const camW = cameraCanvas.width;
    const camH = cameraCanvas.height;

    const cropX = camW * guide.x;
    const cropY = camH * guide.y;
    const cropW = camW * guide.w;
    const cropH = camH * guide.h;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.round(cropW);
    cropCanvas.height = Math.round(cropH);

    const cctx = cropCanvas.getContext("2d");
    cctx.drawImage(
        cameraCanvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
    );

    return cropCanvas;
}



/* =========================================================
   DRAW CROPPED CAMERA IMAGE INTO SMALL LEFT SLOT
========================================================= */
function drawCapturedPaperToPoster(ctx, croppedGuideCanvas, posterW, posterH) {
    const slot = getPosterSlotRect(posterW, posterH);

    // วาดภาพจากกรอบเส้นประลงเฟรมเล็กซ้าย
    ctx.drawImage(croppedGuideCanvas, slot.x, slot.y, slot.w, slot.h);
}

/* =========================================================
   DRAW OVERLAY ON TOP OF SMALL LEFT SLOT
========================================================= */
function drawOverlayToPoster(ctx, posterW, posterH) {
    if (!ghostOverlay.complete || !ghostOverlay.naturalWidth) return;

    const slot = getPosterSlotRect(posterW, posterH);
    const inner = getOverlayInnerRect(slot);

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = overlayOpacity;
    ctx.filter = "contrast(1.06) brightness(1.02)";
    ctx.drawImage(ghostOverlay, inner.x, inner.y, inner.w, inner.h);
    ctx.restore();
}

/* =========================================================
   ADD A LITTLE MOOD / VIGNETTE ON SMALL SLOT
========================================================= */
function addSlotMood(ctx, posterW, posterH) {
    const slot = getPosterSlotRect(posterW, posterH);

    ctx.save();
    const grad = ctx.createRadialGradient(
        slot.x + slot.w / 2,
        slot.y + slot.h / 2,
        Math.min(slot.w, slot.h) * 0.1,
        slot.x + slot.w / 2,
        slot.y + slot.h / 2,
        Math.max(slot.w, slot.h) * 0.7
    );

    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.14)");

    ctx.fillStyle = grad;
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
}

/* =========================================================
   BUILD FINAL POSTER
   = bg ใหญ่ + ภาพ crop ในเฟรมเล็กซ้าย + overlay
========================================================= */
function buildFinalPoster(cameraFrameCanvas) {
    // ขนาด final ใช้ตามขนาด poster-bg ถ้ามี
    const posterW =
        posterReady && posterBg.naturalWidth ? posterBg.naturalWidth : 1920;
    const posterH =
        posterReady && posterBg.naturalHeight ? posterBg.naturalHeight : 1080;

    captureCanvas.width = posterW;
    captureCanvas.height = posterH;
    captureCtx.clearRect(0, 0, posterW, posterH);

    /* =====================================================
       1) วาด "ภาพจากกล้องทั้งเฟรม" ลงเป็น BG จริงก่อน
       ===================================================== */
    captureCtx.drawImage(cameraFrameCanvas, 0, 0, posterW, posterH);

    /* =====================================================
       2) วาด poster-bg.png ทับลงไป
       - ไฟล์นี้ควรเป็น PNG โปร่งใส
       - เช่นมีตัวหนังสือ / layout / decoration / footer
       ===================================================== */
    if (posterReady && posterBg.naturalWidth) {
        captureCtx.drawImage(posterBg, 0, 0, posterW, posterH);
    }

    /* =====================================================
       3) crop ภาพจากกล้องเฉพาะในกรอบซ้าย
       ===================================================== */
    const croppedGuide = cropGuideFromCameraFrame(cameraFrameCanvas);

    /* =====================================================
       4) เอาภาพ crop ไปใส่เฟรมเล็กฝั่งซ้าย
       ===================================================== */
    drawCapturedPaperToPoster(captureCtx, croppedGuide, posterW, posterH);

    /* =====================================================
       5) วาด ghost overlay ทับในเฟรมซ้าย
       ===================================================== */
    drawOverlayToPoster(captureCtx, posterW, posterH);

    /* =====================================================
       6) ใส่มู้ดเงาเบา ๆ ถ้ามึงยังอยากได้
       ===================================================== */
    addSlotMood(captureCtx, posterW, posterH);

    return captureCanvas.toDataURL("image/png");
}

/* =========================================================
   CAPTURE
========================================================= */
function capturePhoto() {
    if (video.readyState < 2) return;

    if (!posterReady) {
        alert("bg poster ยังโหลดไม่เสร็จ ลองรออีกนิดแล้วกดใหม่");
        return;
    }

    triggerFlash();

    const cameraFrameCanvas = getCurrentCameraFrameCanvas();
    const finalDataUrl = buildFinalPoster(cameraFrameCanvas);

    lastCapturedDataUrl = finalDataUrl;
    resultImage.src = finalDataUrl;
    resultScreen.classList.add("show");

    setStatus("ถ่ายสำเร็จ", "กด Download หรือ Retake ได้เลย", true);
}

/* =========================================================
   DOWNLOAD
========================================================= */
function downloadImage() {
    if (!lastCapturedDataUrl) return;

    const a = document.createElement("a");
    a.href = lastCapturedDataUrl;
    a.download = "hint-poster.png";
    a.click();
}

/* =========================================================
   RETAKE
========================================================= */
function retakeCapture() {
    lastCapturedDataUrl = null;
    resultImage.src = "";
    resultScreen.classList.remove("show");

    setStatus(
        "พร้อมถ่าย",
        "เอากระดาษไปวางในกรอบฝั่งซ้าย แล้วกด CAPTURE",
        true
    );
}

/* =========================================================
   LOOP
========================================================= */
function renderLoop() {
    drawHUD();
    animationId = requestAnimationFrame(renderLoop);
}

/* =========================================================
   BOOT
========================================================= */
async function boot() {
    await initCamera();
    renderLoop();
}

/* =========================================================
   EVENTS
========================================================= */
captureBtn.addEventListener("click", capturePhoto);
downloadBtn.addEventListener("click", downloadImage);
retakeBtn.addEventListener("click", retakeCapture);

window.addEventListener("beforeunload", () => {
    if (animationId) cancelAnimationFrame(animationId);
});

boot();