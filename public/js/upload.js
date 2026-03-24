/**
 * File Upload — drag & drop + button
 */

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const overlay = document.getElementById('uploadOverlay');
  const uploadName = document.getElementById('uploadName');
  const uploadFill = document.getElementById('uploadFill');

  // ── File input change ─────────────────────────────────
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // ── Drag & Drop on terminal ───────────────────────────
  const container = document.getElementById('terminalContainer');

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.outline = '2px dashed var(--accent)';
    container.style.outlineOffset = '-4px';
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    container.style.outline = '';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.outline = '';

    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  // ── Upload function ───────────────────────────────────
  function uploadFile(file) {
    uploadName.textContent = file.name;
    uploadFill.style.width = '0%';
    overlay.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', `/tmp/${file.name}`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        uploadFill.style.width = pct + '%';
      }
    });

    xhr.addEventListener('load', () => {
      overlay.classList.add('hidden');
      if (xhr.status === 200) {
        const resp = JSON.parse(xhr.responseText);
        const term = window.termApp.term;
        // Notify in terminal
        term.write(`\r\n\x1b[1;32m📁 Uploaded: ${file.name} → ${resp.path}\x1b[0m\r\n`);
      } else {
        const term = window.termApp.term;
        term.write(`\r\n\x1b[1;31m❌ Upload failed: ${xhr.statusText}\x1b[0m\r\n`);
      }
    });

    xhr.addEventListener('error', () => {
      overlay.classList.add('hidden');
      const term = window.termApp.term;
      term.write(`\r\n\x1b[1;31m❌ Upload error: network failure\x1b[0m\r\n`);
    });

    xhr.send(formData);
  }
});
