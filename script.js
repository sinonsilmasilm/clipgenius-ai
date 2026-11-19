// ===== Configuration =====
// Set this to your deployed backend URL (see backend/README.md, Step 3-4).
// Example: "https://clipgenius-backend.onrender.com"
const API_BASE_URL = "https://REPLACE-WITH-YOUR-BACKEND-URL";

// ===== Element refs =====
const urlInput = document.getElementById("url");
const analyze = document.getElementById("analyze");
const fileInput = document.getElementById("fileInput");
const pickFileBtn = document.getElementById("pickFile");
const uploadLabel = document.getElementById("uploadLabel");
const statusNotice = document.getElementById("statusNotice");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const resultsSection = document.getElementById("results");
const clipsGrid = document.getElementById("clipsGrid");
const languageSelect = document.getElementById("language");
const maxClipsSelect = document.getElementById("maxClips");

let selectedFile = null;

// ===== Helpers =====
function validUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function updateAnalyzeState() {
  const hasUrl = validUrl(urlInput.value);
  const hasFile = Boolean(selectedFile);
  analyze.disabled = !(hasUrl || hasFile) || !backendReachable;
}

let backendReachable = false;

async function checkBackendHealth() {
  if (API_BASE_URL.includes("REPLACE-WITH-YOUR-BACKEND-URL")) {
    statusNotice.textContent =
      "ⓘ　لم يتم ضبط رابط الخادم بعد في script.js (API_BASE_URL). راجع خطوات النشر.";
    backendReachable = false;
    updateAnalyzeState();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    backendReachable = true;
    statusNotice.textContent = data.aiConfigured
      ? "✅　متصل بالخادم ومُهيّأ بالكامل. يمكنك البدء."
      : "⚠️　الخادم متصل لكن مفاتيح الذكاء الاصطناعي غير مضبوطة عليه بعد — لن تعمل عملية التحليل حتى يتم ضبطها.";
  } catch {
    backendReachable = false;
    statusNotice.textContent =
      "⚠️　تعذّر الاتصال بالخادم حالياً. تأكد من أنه يعمل ومن ضبط FRONTEND_ORIGIN عليه.";
  }
  updateAnalyzeState();
}

function setProgress(percent, label) {
  progressWrap.hidden = false;
  progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressLabel.textContent = label;
}

const STATUS_LABELS = {
  queued: "في قائمة الانتظار…",
  transcribing: "جارٍ تفريغ الصوت إلى نص…",
  analyzing: "جارٍ تحليل اللحظات الأكثر تميّزاً…",
  processing: "جارٍ إنتاج المقاطع العمودية…",
  done: "اكتملت المعالجة ✅",
  failed: "فشلت المعالجة ❌",
};

function renderClips(clips) {
  clipsGrid.innerHTML = "";
  resultsSection.hidden = false;
  for (const clip of clips) {
    const card = document.createElement("article");
    card.className = "clip-card";
    const hashtags = (clip.hashtags || []).map((h) => `#${h}`).join(" ");
    card.innerHTML = `
      <div class="clip-head"><b>${escapeHtml(clip.title)}</b><span>${clip.durationSeconds}ث</span></div>
      <p class="clip-desc">${escapeHtml(clip.description)}</p>
      <p class="clip-tags">${escapeHtml(hashtags)}</p>
      <a class="clip-download" href="${API_BASE_URL}${clip.downloadUrl}" target="_blank" rel="noopener">⬇　تنزيل المقطع</a>
      ${!clip.subtitlesBurned ? '<p class="clip-note">ⓘ تعذّر دمج الترجمة في هذا المقطع، لكنه مقطع حقيقي وصالح للتنزيل.</p>' : ""}
    `;
    clipsGrid.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

async function pollJob(jobId) {
  const poll = async () => {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
    } catch {
      setProgress(0, "تعذّر التواصل مع الخادم أثناء المتابعة.");
      return;
    }
    if (!res.ok) {
      setProgress(0, "تعذّر جلب حالة المهمة.");
      return;
    }
    const data = await res.json();
    const label = STATUS_LABELS[data.status] || data.status;
    setProgress(data.progress || 0, label);

    if (data.status === "done") {
      const resultsRes = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/results`);
      const results = await resultsRes.json();
      renderClips(results.clips || []);
      analyze.disabled = false;
      return;
    }
    if (data.status === "failed") {
      setProgress(data.progress || 0, `فشلت المعالجة: ${data.error || "خطأ غير معروف"}`);
      analyze.disabled = false;
      return;
    }
    setTimeout(poll, 3000);
  };
  poll();
}

async function startJob() {
  analyze.disabled = true;
  resultsSection.hidden = true;
  setProgress(5, STATUS_LABELS.queued);

  const formData = new FormData();
  if (selectedFile) {
    formData.append("video", selectedFile);
  } else {
    formData.append("url", urlInput.value);
  }
  formData.append("language", languageSelect.value);
  formData.append("maxClips", maxClipsSelect.value);

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/jobs`, { method: "POST", body: formData });
  } catch (err) {
    setProgress(0, "تعذّر إرسال الطلب إلى الخادم.");
    analyze.disabled = false;
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    setProgress(0, `خطأ: ${data.error || "فشل إنشاء المهمة."}`);
    analyze.disabled = false;
    return;
  }

  pollJob(data.jobId);
}

// ===== Event wiring =====
urlInput.addEventListener("input", () => {
  if (urlInput.value) {
    selectedFile = null;
    fileInput.value = "";
    uploadLabel.textContent = "ارفع ملف الفيديو من جهازك";
  }
  updateAnalyzeState();
});

document.querySelectorAll("#platforms button").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll("#platforms button").forEach((b) => b.classList.remove("selected"));
    button.classList.add("selected");
  })
);

document.getElementById("paste").addEventListener("click", async () => {
  try {
    urlInput.value = await navigator.clipboard.readText();
    urlInput.dispatchEvent(new Event("input"));
  } catch {
    alert("يرجى لصق الرابط يدوياً في الحقل.");
  }
});

pickFileBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  selectedFile = file;
  urlInput.value = "";
  uploadLabel.textContent = `تم اختيار: ${file.name}`;
  updateAnalyzeState();
});

document.getElementById("menu").addEventListener("click", () =>
  document.getElementById("sidebar").classList.toggle("open")
);

analyze.addEventListener("click", startJob);

checkBackendHealth();
