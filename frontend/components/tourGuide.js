// --- DELTA ENGINE — INTERACTIVE ENTERPRISE TOUR GUIDE ---
// Provides a step-by-step interactive spotlight onboarding tutorial across the 7 core pillars:
// 1. Live Matrix & Deterministic Graph Solver
// 2. Universal Schedule & Venue Importer (CSV / Presets)
// 3. Real-Time Optical & Computer Vision Telemetry
// 4. Supervised Autonomy & 15s Action SLA
// 5. NFPA-101 Fire Marshal Regulatory Compliance
// 6. Mobile Field Marshal Terminal (/volunteer)
// 7. Zoned Autonomous Voice Announcements

const tourSteps = [
  {
    title: "1. Live Schedule Matrix & Graph Solver",
    text: "Drag & drop any session card between halls. If an overflow or conflict is detected, DELTA Engine's deterministic solver heals the schedule in <0.2ms with zero hot-path delay.",
    highlightId: "schedule-table"
  },
  {
    title: "2. Universal Dynamic Schedule Importer",
    text: "Zero hardcoding! Click 'Import Schedule' to upload your own CSV schedule or 1-click load presets (Esports Arena, Biotech Symposium, Tech Summit).",
    highlightId: "btn-open-importer"
  },
  {
    title: "3. Real-Time Sensor & Computer Vision Telemetry",
    text: "Monitors real-time attendee ingress via optical LiDAR tripwires, USB webcams, and Eulerian crowd density flux vectors to detect crowd surges before stampedes form.",
    highlightId: "cctv-metric-headcount"
  },
  {
    title: "4. Supervised Autonomy & 15s Action SLA",
    text: "When capacity breaches, a 15-second human-in-the-loop SLA modal gives the safety director triple controls: Approve, Hold for Review, or Abort with cryptographic SHA-256 signatures.",
    highlightId: "reallocation-countdown-modal"
  },
  {
    title: "5. NFPA-101 Fire Marshal Regulatory Audit",
    text: "Calculates density (m²/pax) and portal flow rates under NFPA-101 § 12.7. Generates cryptographically sealed, printable audit certificates for municipal city inspectors.",
    highlightId: "btn-download-fire-marshal-audit"
  },
  {
    title: "6. Mobile Field Marshal Terminal (/volunteer)",
    text: "On-ground staff use the lightweight /volunteer mobile terminal with tactile one-thumb entry/exit clickers and a 1-tap emergency SOS panic button.",
    highlightId: "btn-open-scenario-hub"
  },
  {
    title: "7. Autonomous Zoned Voice Announcements",
    text: "When schedules adapt, ElevenLabs voice broadcasts route directly to hallways and foyer signage speakers, preserving silence inside active lecture auditoriums.",
    highlightId: "speaker-pills-container"
  }
];

let currentTourStep = 0;

function initTourGuide() {
  const card = document.getElementById('tour-card');
  const btnToggle = document.getElementById('btn-toggle-tour');
  const minimizedBar = document.getElementById('tour-minimized-bar');
  const btnNext = document.getElementById('btn-tour-next');
  const btnPrev = document.getElementById('btn-tour-prev');
  const textStep = document.getElementById('tour-step-text');
  const stepInd = document.getElementById('tour-step-indicator');

  if (!card) return;

  // Click on 90-degree vertical minimized bar -> Expand Tour Guide Card
  if (minimizedBar) {
    minimizedBar.addEventListener('click', () => {
      card.classList.remove('collapsed');
      renderTourStep();
    });
  }

  // Click on '-' minimize button -> Collapse into 90-degree vertical tab on right edge
  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('collapsed');
    });
  }

  // OS Sync Utilities Tour Guide button
  const btnShowTour = document.getElementById('btn-show-tour');
  if (btnShowTour) {
    btnShowTour.addEventListener('click', () => {
      card.classList.remove('collapsed');
      renderTourStep();
    });
  }

  // Next step
  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTourStep = (currentTourStep + 1) % tourSteps.length;
      renderTourStep();
    });
  }

  // Prev step
  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTourStep = (currentTourStep - 1 + tourSteps.length) % tourSteps.length;
      renderTourStep();
    });
  }

  function renderTourStep() {
    const step = tourSteps[currentTourStep];
    if (textStep) {
      textStep.innerHTML = `<strong style="display:block; font-size:0.85rem; color:#0f172a; margin-bottom:4px;">${step.title}</strong>${step.text}`;
    }
    if (stepInd) {
      stepInd.textContent = `${currentTourStep + 1} / ${tourSteps.length}`;
    }
    
    // Highlight elements visually on page
    document.querySelectorAll('.highlight-tour').forEach(el => el.classList.remove('highlight-tour'));
    
    const highlightTarget = document.getElementById(step.highlightId);
    if (highlightTarget) {
      highlightTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightTarget.style.outline = '4px solid #facc15';
      highlightTarget.style.outlineOffset = '4px';
      setTimeout(() => {
        if (highlightTarget) highlightTarget.style.outline = 'none';
      }, 3000);
    }
  }

  renderTourStep();
}
