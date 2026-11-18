const urlInput=document.getElementById("url");const analyze=document.getElementById("analyze");
function validUrl(value){try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}
urlInput.addEventListener("input",()=>{analyze.disabled=!validUrl(urlInput.value)});
document.querySelectorAll("#platforms button").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("#platforms button").forEach(b=>b.classList.remove("selected"));button.classList.add("selected")}));
document.getElementById("paste").addEventListener("click",async()=>{try{urlInput.value=await navigator.clipboard.readText();urlInput.dispatchEvent(new Event("input"))}catch{alert("يرجى لصق الرابط يدوياً في الحقل.")}});
document.getElementById("menu").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
analyze.addEventListener("click",()=>alert("واجهة ClipGenius AI جاهزة، لكن خادم تحليل الفيديو لم يُربط بعد. هذه النسخة لا تدّعي معالجة الفيديو."));
