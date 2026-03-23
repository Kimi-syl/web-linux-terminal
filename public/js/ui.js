/**
 * UI Controls — buttons, keyboard shortcuts, fullscreen
 */

document.addEventListener('DOMContentLoaded', () => {
  // Font buttons
  document.getElementById('btnFontDown').addEventListener('click', () => {
    window.termApp.changeFontSize(-1);
  });
  document.getElementById('btnFontUp').addEventListener('click', () => {
    window.termApp.changeFontSize(1);
  });

  // Theme button
  document.getElementById('btnTheme').addEventListener('click', () => {
    window.termApp.toggleTheme();
  });

  // New terminal
  document.getElementById('btnNewTerm').addEventListener('click', () => {
    if (window.termApp.socket) {
      window.termApp.socket.disconnect();
    }
    window.termApp.term.clear();
    setTimeout(() => {
      window.termApp.socket.connect();
    }, 200);
  });

  // Fullscreen
  document.getElementById('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // F11 fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  });

  // Shortcuts help (? key when not focused on terminal)
  const shortcutsHelp = document.getElementById('shortcutsHelp');
  document.getElementById('btnCloseHelp').addEventListener('click', () => {
    shortcutsHelp.classList.add('hidden');
  });

  shortcutsHelp.addEventListener('click', (e) => {
    if (e.target === shortcutsHelp) {
      shortcutsHelp.classList.add('hidden');
    }
  });

  // Show help with ? (only when terminal not focused would be ideal,
  // but we capture it globally with a flag)
  let helpVisible = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Only toggle if the terminal isn't actively receiving input
      // (i.e., user might be at shell prompt)
      helpVisible = !helpVisible;
      shortcutsHelp.classList.toggle('hidden', !helpVisible);
    }
    if (e.key === 'Escape' && helpVisible) {
      helpVisible = false;
      shortcutsHelp.classList.add('hidden');
    }
  });
});
